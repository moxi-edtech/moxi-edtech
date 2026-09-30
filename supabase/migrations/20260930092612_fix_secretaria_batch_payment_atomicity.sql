CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_itens jsonb,
  p_metodo public.pagamento_metodo,
  p_idempotency_key text,
  p_reference text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_count integer;
  v_existing_count integer;
  v_existing jsonb;
  v_existing_fingerprint text;
  v_fingerprint text;
  v_item jsonb;
  v_index integer;
  v_type text;
  v_item_id uuid;
  v_amount numeric;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_matricula public.matriculas%ROWTYPE;
  v_ano public.anos_letivos%ROWTYPE;
  v_window record;
  v_billing_year integer;
  v_billing_turma_id uuid;
  v_competencia date;
  v_inicio_mes date;
  v_fim_mes date;
  v_matricula_origem_id uuid;
  v_child_key text;
  v_child_meta jsonb;
  v_payment public.pagamentos%ROWTYPE;
  v_payments jsonb := '[]'::jsonb;
  v_last_payment jsonb := NULL;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT public.user_has_role_in_school(
       p_escola_id,
       ARRAY[
         'secretaria',
         'financeiro',
         'secretaria_financeiro',
         'admin_financeiro',
         'admin_escola',
         'admin',
         'staff_admin'
       ]
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  IF COALESCE(btrim(p_idempotency_key), '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'IDEMPOTENCY_KEY_REQUIRED',
      'error', 'Idempotency-Key é obrigatório.'
    );
  END IF;

  IF jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'INVALID_ITEMS',
      'error', 'Os itens do checkout devem formar uma lista.'
    );
  END IF;

  v_count := jsonb_array_length(p_itens);
  IF v_count < 1 OR v_count > 50 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'INVALID_ITEMS_COUNT',
      'error', 'O checkout deve conter entre 1 e 50 itens.'
    );
  END IF;

  IF p_metodo = 'tpa' AND COALESCE(btrim(p_reference), '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'REFERENCE_REQUIRED_FOR_TPA',
      'error', 'Referência é obrigatória para pagamentos TPA.'
    );
  END IF;

  IF p_metodo = 'transfer' AND COALESCE(btrim(p_evidence_url), '') = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'EVIDENCE_REQUIRED_FOR_TRANSFER',
      'error', 'Comprovativo é obrigatório para transferência.'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value->>'tipo' AS tipo, value->>'id' AS id, count(*) AS total
      FROM jsonb_array_elements(p_itens)
      GROUP BY value->>'tipo', value->>'id'
      HAVING count(*) > 1
    ) duplicated
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'DUPLICATE_CHECKOUT_ITEM',
      'error', 'O checkout contém itens duplicados.'
    );
  END IF;

  v_fingerprint := md5(
    jsonb_build_object(
      'escola_id', p_escola_id,
      'aluno_id', p_aluno_id,
      'itens', p_itens,
      'metodo', p_metodo::text,
      'reference', p_reference,
      'evidence_url', p_evidence_url,
      'gateway_ref', p_gateway_ref
    )::text
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('financeiro:batch:' || p_escola_id::text || ':' || p_idempotency_key, 0)
  );

  SELECT
    count(*),
    COALESCE(
      jsonb_agg(to_jsonb(p) ORDER BY COALESCE((p.meta->>'batch_index')::integer, 0)),
      '[]'::jsonb
    ),
    min(p.meta->>'batch_fingerprint')
  INTO v_existing_count, v_existing, v_existing_fingerprint
  FROM public.pagamentos p
  WHERE p.escola_id = p_escola_id
    AND p.meta->>'batch_idempotency_key' = p_idempotency_key;

  IF v_existing_count > 0 THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 409,
        'code', 'IDEMPOTENCY_KEY_CONFLICT',
        'error', 'A mesma Idempotency-Key já foi usada com outro checkout.'
      );
    END IF;

    IF v_existing_count = v_count THEN
      SELECT value
      INTO v_last_payment
      FROM jsonb_array_elements(v_existing)
      WITH ORDINALITY AS x(value, ordinality)
      ORDER BY ordinality DESC
      LIMIT 1;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'data', v_last_payment,
        'pagamentos', v_existing
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'PARTIAL_BATCH_REQUIRES_RECONCILIATION',
      'error', 'Foi detectado um checkout parcialmente liquidado com esta chave. É necessária reconciliação manual.'
    );
  END IF;

  -- Validate the complete batch before the first financial write. This keeps
  -- application-only billing-window rules from becoming partial settlements.
  FOR v_item, v_index IN
    SELECT value, ordinality::integer
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 400,
        'code', 'INVALID_ITEM',
        'error', format('Item inválido na posição %s.', v_index)
      );
    END IF;

    v_type := v_item->>'tipo';
    IF v_type NOT IN ('mensalidade', 'servico') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 400,
        'code', 'INVALID_ITEM_TYPE',
        'error', format('Tipo de item inválido na posição %s.', v_index)
      );
    END IF;

    BEGIN
      v_item_id := (v_item->>'id')::uuid;
      v_amount := (v_item->>'preco')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 400,
        'code', 'INVALID_ITEM',
        'error', format('ID ou valor inválido na posição %s.', v_index)
      );
    END;

    IF v_amount <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'status', 400,
        'code', 'INVALID_ITEM_VALUE',
        'error', format('O valor do item na posição %s deve ser positivo.', v_index)
      );
    END IF;

    IF v_type = 'mensalidade' THEN
      SELECT *
      INTO v_mensalidade
      FROM public.mensalidades
      WHERE id = v_item_id
        AND escola_id = p_escola_id
      LIMIT 1;

      IF NOT FOUND OR v_mensalidade.matricula_id IS NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 404,
          'code', 'ACADEMIC_ENTITY_NOT_FOUND',
          'error', 'Mensalidade não encontrada.'
        );
      END IF;

      SELECT *
      INTO v_matricula
      FROM public.matriculas
      WHERE id = v_mensalidade.matricula_id
        AND escola_id = p_escola_id
      LIMIT 1;

      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'ACADEMIC_ENTITY_NOT_FOUND',
          'error', 'A matrícula da mensalidade não foi encontrada.'
        );
      END IF;

      IF v_mensalidade.aluno_id IS DISTINCT FROM p_aluno_id
         AND v_matricula.aluno_id IS DISTINCT FROM p_aluno_id THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'ACADEMIC_ENTITY_NOT_FOUND',
          'error', 'A mensalidade não pertence ao aluno selecionado.'
        );
      END IF;

      v_billing_year := COALESCE(
        NULLIF(v_mensalidade.ano_letivo, 0),
        NULLIF(v_mensalidade.ano_referencia, 0),
        NULLIF(v_matricula.ano_letivo, 0)
      );

      IF v_billing_year IS NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'ACADEMIC_YEAR_NOT_FOUND',
          'error', 'O ano letivo da mensalidade não foi encontrado.'
        );
      END IF;

      SELECT *
      INTO v_ano
      FROM public.anos_letivos
      WHERE escola_id = p_escola_id
        AND ano = v_billing_year
      ORDER BY ativo DESC NULLS LAST, data_inicio DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'ACADEMIC_YEAR_NOT_FOUND',
          'error', 'O ano letivo da mensalidade não foi encontrado.'
        );
      END IF;

      v_billing_turma_id := COALESCE(v_mensalidade.turma_id, v_matricula.turma_id);

      IF v_mensalidade.mes_referencia IS NOT NULL
         AND v_mensalidade.ano_referencia IS NOT NULL
         AND v_billing_turma_id IS NOT NULL THEN
        SELECT *
        INTO v_window
        FROM public.resolve_turma_janela_cobranca(v_billing_turma_id, v_ano.id)
        LIMIT 1;

        IF NOT FOUND OR v_window.data_inicio IS NULL OR v_window.data_fim IS NULL THEN
          RETURN jsonb_build_object(
            'ok', false,
            'status', 500,
            'code', 'BILLING_WINDOW_RESOLUTION_FAILED',
            'error', 'Não foi possível resolver a janela de cobrança da turma.'
          );
        END IF;

        v_competencia := make_date(
          v_mensalidade.ano_referencia,
          v_mensalidade.mes_referencia,
          1
        );
        v_inicio_mes := date_trunc('month', v_window.data_inicio)::date;
        v_fim_mes := date_trunc('month', v_window.data_fim)::date;

        IF v_competencia < v_inicio_mes
           OR v_competencia > v_fim_mes
           OR (
             COALESCE(v_window.is_classe_exame, false) IS FALSE
             AND v_competencia = v_fim_mes
           ) THEN
          RETURN jsonb_build_object(
            'ok', false,
            'status', 409,
            'code', 'MONTH_OUTSIDE_ACADEMIC_YEAR',
            'error', 'Esta mensalidade está fora da janela de cobrança da turma e não pode ser liquidada.',
            'context', jsonb_build_object(
              'turma_id', v_billing_turma_id,
              'ano_letivo_id', v_ano.id,
              'ano', v_ano.ano,
              'data_inicio_permitida', v_window.data_inicio,
              'data_fim_permitida', v_window.data_fim,
              'competencia', format(
                '%s-%s',
                v_mensalidade.ano_referencia,
                lpad(v_mensalidade.mes_referencia::text, 2, '0')
              )
            ),
            'next_action', jsonb_build_object(
              'type', 'contact_secretaria',
              'label', 'Rever o ano letivo, a turma e a competência',
              'href', '/secretaria/operacoes-academicas'
            )
          );
        END IF;
      END IF;

      IF COALESCE(p_meta->>'origem', '') = 'pos_virada' THEN
        BEGIN
          v_matricula_origem_id := COALESCE(
            NULLIF(v_item->>'origem_matricula_id', '')::uuid,
            NULLIF(p_meta->>'matricula_origem_id', '')::uuid,
            NULLIF(p_meta->>'matricula_id', '')::uuid
          );
        EXCEPTION WHEN OTHERS THEN
          v_matricula_origem_id := NULL;
        END;

        IF v_matricula_origem_id IS NULL
           OR v_matricula_origem_id IS DISTINCT FROM v_mensalidade.matricula_id THEN
          RETURN jsonb_build_object(
            'ok', false,
            'status', 409,
            'code', 'POS_VIRADA_CONTEXT_MISMATCH',
            'error', 'A mensalidade não pertence à matrícula de origem da pendência.'
          );
        END IF;
      ELSIF COALESCE(v_matricula.ano_letivo, 0) > 0
            AND v_matricula.ano_letivo IS DISTINCT FROM v_billing_year THEN
        RETURN jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'CROSS_YEAR_ENTITY_MISMATCH',
          'error', 'A entidade não pertence ao ano letivo da mensalidade.'
        );
      END IF;
    END IF;
  END LOOP;

  -- Writers run in one PostgreSQL statement/transaction. If any canonical
  -- writer raises, PostgreSQL rolls back every earlier item in this batch.
  -- Mensalidades are processed oldest-first so a checkout may settle several
  -- consecutive competencies even if the UI added them in another order.
  FOR v_item, v_index IN
    SELECT x.value, x.ordinality::integer
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS x(value, ordinality)
    LEFT JOIN public.mensalidades m
      ON x.value->>'tipo' = 'mensalidade'
     AND m.id = (x.value->>'id')::uuid
    ORDER BY
      CASE WHEN x.value->>'tipo' = 'mensalidade' THEN 0 ELSE 1 END,
      COALESCE(m.ano_referencia, EXTRACT(YEAR FROM m.data_vencimento)::integer, 9999),
      COALESCE(m.mes_referencia, EXTRACT(MONTH FROM m.data_vencimento)::integer, 12),
      m.data_vencimento NULLS LAST,
      x.ordinality
  LOOP
    v_type := v_item->>'tipo';
    v_item_id := (v_item->>'id')::uuid;
    v_amount := (v_item->>'preco')::numeric;
    v_child_key := p_idempotency_key || ':' || (v_index - 1)::text;

    v_child_meta := COALESCE(p_meta, '{}'::jsonb)
      || jsonb_build_object(
        'idempotency_key', v_child_key,
        'batch_idempotency_key', p_idempotency_key,
        'batch_fingerprint', v_fingerprint,
        'batch_index', v_index - 1,
        'batch_method', p_metodo::text,
        'descricao_item', COALESCE(
          NULLIF(btrim(v_item->>'nome'), ''),
          CASE WHEN v_type = 'mensalidade' THEN 'Mensalidade' ELSE 'Serviço escolar' END
        ),
        'matricula_id', COALESCE(
          NULLIF(p_meta->>'matricula_id', ''),
          NULLIF(v_item->>'origem_matricula_id', '')
        ),
        'matricula_origem_id', COALESCE(
          NULLIF(v_item->>'origem_matricula_id', ''),
          NULLIF(p_meta->>'matricula_origem_id', ''),
          NULLIF(p_meta->>'matricula_id', '')
        ),
        'itens', p_itens,
        'emitir_recibo', v_index = v_count
      );

    SELECT *
    INTO v_payment
    FROM public.financeiro_registrar_pagamento_secretaria(
      p_escola_id,
      p_aluno_id,
      CASE WHEN v_type = 'mensalidade' THEN v_item_id ELSE NULL END,
      v_amount,
      p_metodo,
      p_reference,
      p_evidence_url,
      p_gateway_ref,
      v_child_meta
    );

    v_payments := v_payments || jsonb_build_array(
      jsonb_build_object(
        'batch_index', v_index - 1,
        'payment', to_jsonb(v_payment)
      )
    );
  END LOOP;

  SELECT entry->'payment'
  INTO v_last_payment
  FROM jsonb_array_elements(v_payments) entry
  WHERE (entry->>'batch_index')::integer = v_count - 1
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'data', v_last_payment,
    'pagamentos', (
      SELECT COALESCE(
        jsonb_agg(entry->'payment' ORDER BY (entry->>'batch_index')::integer),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(v_payments) entry
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  uuid,
  uuid,
  jsonb,
  public.pagamento_metodo,
  text,
  text,
  text,
  text,
  jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.financeiro_registrar_pagamentos_secretaria_batch(
  uuid,
  uuid,
  jsonb,
  public.pagamento_metodo,
  text,
  text,
  text,
  text,
  jsonb
) TO authenticated, service_role;
