BEGIN;

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  escola_id uuid NOT NULL,
  key text NOT NULL,
  scope text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (escola_id, scope, key)
);

GRANT SELECT, INSERT, UPDATE ON TABLE public.idempotency_keys TO authenticated;

CREATE OR REPLACE FUNCTION public.admissao_finalizar_matricula(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_turma_id uuid,
  p_pagamento jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL::text,
  p_observacao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_escola_id();
  v_cand public.candidaturas%ROWTYPE;
  v_turma record;
  v_active_ano integer;
  v_preco_id uuid;
  v_origem_preco text;
  v_valor_matricula numeric(12,2);
  v_valor_mensalidade numeric(12,2);
  v_dia_vencimento integer;
  v_payment jsonb := coalesce(p_pagamento, '{}'::jsonb);
  v_payment_base jsonb := '{}'::jsonb;
  v_payment_metadata jsonb := '{}'::jsonb;
  v_dados jsonb := '{}'::jsonb;
  v_amount numeric(12,2);
  v_amount_raw text;
  v_metodo text;
  v_referencia text;
  v_comprovativo_url text;
  v_is_parcial boolean := false;
  v_status text;
  v_matricula_id uuid;
  v_numero_matricula text;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_existing jsonb;
  v_result jsonb;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida.';
  END IF;

  IF p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'Candidatura obrigatória.';
  END IF;

  IF p_turma_id IS NULL THEN
    RAISE EXCEPTION 'Selecione a turma antes de finalizar a matrícula.';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id,
    array['secretaria','admin','admin_escola','staff_admin','financeiro']
  ) THEN
    RAISE EXCEPTION 'Acesso negado: permissões insuficientes.';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT ik.result
    INTO v_existing
    FROM public.idempotency_keys ik
    WHERE ik.escola_id = p_escola_id
      AND ik.scope = 'admissao_finalizar_matricula'
      AND ik.key = v_idempotency_key;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT *
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = v_tenant
  FOR UPDATE;

  IF v_cand.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada ou acesso negado.';
  END IF;

  v_status := lower(coalesce(v_cand.status, ''));

  IF v_status IN ('matriculado', 'convertida', 'convertido') THEN
    IF v_cand.matricula_id IS NULL THEN
      RAISE EXCEPTION 'Candidatura já convertida, mas sem matrícula vinculada.';
    END IF;

    SELECT m.numero_matricula::text
    INTO v_numero_matricula
    FROM public.matriculas m
    WHERE m.id = v_cand.matricula_id
      AND m.escola_id = p_escola_id;

    v_result := jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'candidatura_id', p_candidatura_id,
      'matricula_id', v_cand.matricula_id,
      'numero_matricula', v_numero_matricula,
      'status', 'matriculado'
    );

    IF v_idempotency_key IS NOT NULL THEN
      INSERT INTO public.idempotency_keys(escola_id, scope, key, result)
      VALUES (p_escola_id, 'admissao_finalizar_matricula', v_idempotency_key, v_result)
      ON CONFLICT (escola_id, scope, key) DO UPDATE
      SET result = EXCLUDED.result;
    END IF;

    RETURN v_result;
  END IF;

  IF v_status NOT IN (
    'rascunho',
    'submetida',
    'em_analise',
    'pendente',
    'aprovada',
    'aguardando_pagamento',
    'aguardando_compensacao'
  ) THEN
    RAISE EXCEPTION 'Transição inválida: status atual = %', coalesce(v_cand.status, 'NULL');
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.curso_id,
    t.classe_id,
    t.ano_letivo,
    t.turno
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id
    AND t.escola_id = p_escola_id;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'Turma não pertence à escola.';
  END IF;

  IF v_turma.curso_id IS NULL OR v_turma.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'Turma incompleta: curso ou ano letivo não configurado.';
  END IF;

  SELECT al.ano
  INTO v_active_ano
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ativo = true
  ORDER BY al.ano DESC
  LIMIT 1;

  IF v_active_ano IS NOT NULL AND v_turma.ano_letivo IS DISTINCT FROM v_active_ano THEN
    RAISE EXCEPTION
      'Turma selecionada pertence ao ano letivo %, mas o ano letivo ativo é %.',
      v_turma.ano_letivo,
      v_active_ano;
  END IF;

  WITH regras AS (
    SELECT
      ft.id,
      ft.valor_matricula,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      ft.updated_at,
      ft.created_at,
      'especifica'::text AS origem,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = p_escola_id
      AND ft.ano_letivo = v_turma.ano_letivo
      AND v_turma.classe_id IS NOT NULL
      AND ft.curso_id = v_turma.curso_id
      AND ft.classe_id = v_turma.classe_id

    UNION ALL

    SELECT
      ft.id,
      ft.valor_matricula,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      ft.updated_at,
      ft.created_at,
      'curso'::text AS origem,
      2 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = p_escola_id
      AND ft.ano_letivo = v_turma.ano_letivo
      AND ft.curso_id = v_turma.curso_id
      AND ft.classe_id IS NULL

    UNION ALL

    SELECT
      ft.id,
      ft.valor_matricula,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      ft.updated_at,
      ft.created_at,
      'classe'::text AS origem,
      3 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = p_escola_id
      AND ft.ano_letivo = v_turma.ano_letivo
      AND v_turma.classe_id IS NOT NULL
      AND ft.curso_id IS NULL
      AND ft.classe_id = v_turma.classe_id

    UNION ALL

    SELECT
      ft.id,
      ft.valor_matricula,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      ft.updated_at,
      ft.created_at,
      'geral'::text AS origem,
      4 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = p_escola_id
      AND ft.ano_letivo = v_turma.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id IS NULL
  )
  SELECT
    r.id,
    r.origem,
    r.valor_matricula,
    r.valor_mensalidade,
    r.dia_vencimento
  INTO
    v_preco_id,
    v_origem_preco,
    v_valor_matricula,
    v_valor_mensalidade,
    v_dia_vencimento
  FROM regras r
  ORDER BY r.prioridade, r.updated_at DESC NULLS LAST, r.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_preco_id IS NULL OR coalesce(v_valor_matricula, 0) <= 0 THEN
    RAISE EXCEPTION
      'Tabela de preço da matrícula não configurada para a turma/ano letivo selecionado.';
  END IF;

  v_metodo := upper(nullif(trim(coalesce(v_payment->>'metodo_pagamento', v_payment->>'metodo', 'CASH')), ''));
  IF v_metodo IS NULL THEN
    v_metodo := 'CASH';
  END IF;

  IF v_metodo NOT IN ('TPA', 'CASH', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'Método de pagamento inválido: %', v_metodo;
  END IF;

  v_is_parcial := lower(coalesce(v_payment->>'parcial', 'false')) IN ('true', '1', 'yes', 'sim');
  v_amount_raw := nullif(trim(coalesce(v_payment->>'amount', v_payment->>'valor_pago', '')), '');

  IF v_amount_raw IS NOT NULL THEN
    BEGIN
      v_amount := v_amount_raw::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Valor pago inválido.';
    END;
  END IF;

  IF v_is_parcial THEN
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Informe o valor pago.';
    END IF;

    IF v_amount >= v_valor_matricula THEN
      RAISE EXCEPTION 'Pagamento parcial deve ser menor que o valor total da matrícula.';
    END IF;
  ELSE
    v_amount := v_valor_matricula;
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor da matrícula inválido.';
  END IF;

  v_referencia := nullif(trim(coalesce(v_payment->>'referencia', '')), '');
  v_comprovativo_url := nullif(trim(coalesce(v_payment->>'comprovativo_url', '')), '');

  IF jsonb_typeof(coalesce(v_cand.dados_candidato, '{}'::jsonb)) = 'object' THEN
    v_dados := coalesce(v_cand.dados_candidato, '{}'::jsonb);
  ELSE
    v_dados := '{}'::jsonb;
  END IF;

  v_payment_base :=
    CASE
      WHEN jsonb_typeof(v_dados->'pagamento') = 'object' THEN v_dados->'pagamento'
      ELSE '{}'::jsonb
    END;

  v_payment_metadata := jsonb_strip_nulls(jsonb_build_object(
    'metodo', v_metodo,
    'amount', v_amount,
    'parcial', v_is_parcial,
    'valor_matricula', v_valor_matricula,
    'financeiro_tabela_id', v_preco_id,
    'origem_preco', v_origem_preco,
    'referencia', v_referencia,
    'comprovativo_url', v_comprovativo_url
  ));

  v_dados :=
    v_dados ||
    jsonb_build_object(
      'curso_id', v_turma.curso_id,
      'classe_id', v_turma.classe_id,
      'turma_preferencial_id', v_turma.id,
      'ano_letivo', v_turma.ano_letivo,
      'turno', v_turma.turno,
      'pagamento', v_payment_base || v_payment_metadata
    );

  UPDATE public.candidaturas
  SET
    curso_id = v_turma.curso_id,
    classe_id = v_turma.classe_id,
    turma_preferencial_id = v_turma.id,
    ano_letivo = v_turma.ano_letivo,
    turno = v_turma.turno,
    dados_candidato = v_dados,
    updated_at = now()
  WHERE id = p_candidatura_id
    AND escola_id = p_escola_id;

  IF v_status = 'rascunho' THEN
    INSERT INTO public.candidaturas_status_log (
      escola_id,
      candidatura_id,
      from_status,
      to_status,
      motivo,
      metadata
    ) VALUES (
      p_escola_id,
      p_candidatura_id,
      v_cand.status,
      'submetida',
      coalesce(p_observacao, 'Finalização de matrícula via RPC oficial'),
      jsonb_build_object('turma_id', p_turma_id, 'source', 'admissao_finalizar_matricula')
    );

    PERFORM set_config('app.rpc_internal', 'on', true);

    UPDATE public.candidaturas
    SET
      status = 'submetida',
      source = coalesce(nullif(source, ''), 'walkin'),
      updated_at = now()
    WHERE id = p_candidatura_id
      AND escola_id = p_escola_id;

    v_status := 'submetida';
  END IF;

  IF v_status IN ('submetida', 'em_analise', 'pendente') THEN
    INSERT INTO public.candidaturas_status_log (
      escola_id,
      candidatura_id,
      from_status,
      to_status,
      motivo,
      metadata
    ) VALUES (
      p_escola_id,
      p_candidatura_id,
      v_status,
      'aprovada',
      coalesce(p_observacao, 'Aprovação automática na finalização de matrícula'),
      jsonb_build_object('turma_id', p_turma_id, 'source', 'admissao_finalizar_matricula')
    );

    PERFORM set_config('app.rpc_internal', 'on', true);

    UPDATE public.candidaturas
    SET
      status = 'aprovada',
      dados_candidato = coalesce(dados_candidato, '{}'::jsonb) ||
        jsonb_build_object(
          'aprovacao_obs', p_observacao,
          'aprovada_at', now()
        ),
      updated_at = now()
    WHERE id = p_candidatura_id
      AND escola_id = p_escola_id;

    v_status := 'aprovada';
  END IF;

  SELECT public.admissao_convert_to_matricula(
    p_escola_id,
    p_candidatura_id,
    jsonb_build_object(
      'turma_id', p_turma_id,
      'metodo_pagamento', v_metodo,
      'amount', v_amount,
      'parcial', v_is_parcial,
      'referencia', v_referencia,
      'comprovativo_url', v_comprovativo_url,
      'valor_matricula', v_valor_matricula,
      'financeiro_tabela_id', v_preco_id,
      'origem_preco', v_origem_preco,
      'idempotency_key', v_idempotency_key,
      'source', 'admissao_finalizar_matricula'
    )
  )
  INTO v_matricula_id;

  SELECT m.numero_matricula::text
  INTO v_numero_matricula
  FROM public.matriculas m
  WHERE m.id = v_matricula_id
    AND m.escola_id = p_escola_id;

  v_result := jsonb_build_object(
    'ok', true,
    'candidatura_id', p_candidatura_id,
    'matricula_id', v_matricula_id,
    'numero_matricula', v_numero_matricula,
    'turma_id', p_turma_id,
    'curso_id', v_turma.curso_id,
    'classe_id', v_turma.classe_id,
    'ano_letivo', v_turma.ano_letivo,
    'valor_matricula', v_valor_matricula,
    'valor_pago', v_amount,
    'pagamento_parcial', v_is_parcial,
    'origem_preco', v_origem_preco,
    'status', 'matriculado'
  );

  IF v_idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotency_keys(escola_id, scope, key, result)
    VALUES (p_escola_id, 'admissao_finalizar_matricula', v_idempotency_key, v_result)
    ON CONFLICT (escola_id, scope, key) DO UPDATE
    SET result = EXCLUDED.result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admissao_finalizar_matricula(uuid, uuid, uuid, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admissao_finalizar_matricula(uuid, uuid, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_finalizar_matricula(uuid, uuid, uuid, jsonb, text, text) TO service_role;

COMMIT;
