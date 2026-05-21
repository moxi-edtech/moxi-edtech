BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_validar_ordem_pagamento_mensalidade(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_mensalidade_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_target public.mensalidades%ROWTYPE;
  v_blocking public.mensalidades%ROWTYPE;
  v_target_ref text;
  v_blocking_ref text;
BEGIN
  IF p_mensalidade_id IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT *
    INTO v_target
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
    AND escola_id = p_escola_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'mensalidade_not_found',
      'message', 'Mensalidade não encontrada.'
    );
  END IF;

  IF v_target.aluno_id IS DISTINCT FROM p_aluno_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'mensalidade_aluno_mismatch',
      'message', 'A mensalidade informada não pertence ao aluno selecionado.'
    );
  END IF;

  SELECT *
    INTO v_blocking
  FROM public.mensalidades m
  WHERE m.escola_id = v_target.escola_id
    AND m.aluno_id = v_target.aluno_id
    AND m.id <> v_target.id
    AND COALESCE(lower(m.status), 'pendente') NOT IN ('pago', 'cancelado', 'isento')
    AND (
      ROW(
        COALESCE(m.ano_referencia, EXTRACT(YEAR FROM m.data_vencimento)::int),
        COALESCE(m.mes_referencia, EXTRACT(MONTH FROM m.data_vencimento)::int),
        m.data_vencimento,
        m.created_at,
        m.id
      ) < ROW(
        COALESCE(v_target.ano_referencia, EXTRACT(YEAR FROM v_target.data_vencimento)::int),
        COALESCE(v_target.mes_referencia, EXTRACT(MONTH FROM v_target.data_vencimento)::int),
        v_target.data_vencimento,
        v_target.created_at,
        v_target.id
      )
    )
  ORDER BY
    COALESCE(m.ano_referencia, EXTRACT(YEAR FROM m.data_vencimento)::int),
    COALESCE(m.mes_referencia, EXTRACT(MONTH FROM m.data_vencimento)::int),
    m.data_vencimento,
    m.created_at,
    m.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_target_ref := lpad(
    COALESCE(v_target.mes_referencia, EXTRACT(MONTH FROM v_target.data_vencimento)::int)::text,
    2,
    '0'
  ) || '/' || COALESCE(v_target.ano_referencia, EXTRACT(YEAR FROM v_target.data_vencimento)::int)::text;

  v_blocking_ref := lpad(
    COALESCE(v_blocking.mes_referencia, EXTRACT(MONTH FROM v_blocking.data_vencimento)::int)::text,
    2,
    '0'
  ) || '/' || COALESCE(v_blocking.ano_referencia, EXTRACT(YEAR FROM v_blocking.data_vencimento)::int)::text;

  RETURN jsonb_build_object(
    'ok', false,
    'error_code', 'mensalidade_anterior_em_aberto',
    'message', format(
      'Regularize primeiro a mensalidade %s antes de receber %s.',
      v_blocking_ref,
      v_target_ref
    ),
    'blocking_mensalidade_id', v_blocking.id,
    'blocking_status', v_blocking.status,
    'blocking_data_vencimento', v_blocking.data_vencimento
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_mensalidade_id uuid,
  p_metodo_pagamento text,
  p_observacao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_valor_pago numeric;
  v_lancamento_id uuid;
  v_metodo_enum public.metodo_pagamento_enum;
  v_descricao text;
  v_ordem jsonb;
BEGIN
  SELECT * INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada.');
  END IF;

  IF v_mensalidade.status = 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta mensalidade já foi paga.');
  END IF;

  v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
    v_mensalidade.escola_id,
    v_mensalidade.aluno_id,
    v_mensalidade.id
  );

  IF COALESCE((v_ordem->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', COALESCE(v_ordem->>'message', 'Existe uma mensalidade anterior em aberto.')
    );
  END IF;

  v_valor_pago := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor);

  UPDATE public.mensalidades
  SET
    status = 'pago',
    valor_pago_total = v_valor_pago,
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = p_observacao,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  v_metodo_enum := CASE lower(coalesce(p_metodo_pagamento, ''))
    WHEN 'dinheiro' THEN 'numerario'
    WHEN 'numerario' THEN 'numerario'
    WHEN 'tpa' THEN 'multicaixa'
    WHEN 'tpa_fisico' THEN 'multicaixa'
    WHEN 'multicaixa' THEN 'multicaixa'
    WHEN 'transferencia' THEN 'transferencia'
    WHEN 'mbway' THEN 'deposito'
    WHEN 'referencia' THEN 'deposito'
    WHEN 'deposito' THEN 'deposito'
    ELSE NULL
  END;

  v_descricao := CASE
    WHEN v_mensalidade.ano_referencia IS NOT NULL AND v_mensalidade.mes_referencia IS NOT NULL THEN
      'Mensalidade ' || to_char(make_date(v_mensalidade.ano_referencia, v_mensalidade.mes_referencia, 1), 'TMMon/YYYY')
    ELSE 'Mensalidade'
  END;

  SELECT id
    INTO v_lancamento_id
  FROM public.financeiro_lancamentos
  WHERE escola_id = v_mensalidade.escola_id
    AND aluno_id = v_mensalidade.aluno_id
    AND origem = 'mensalidade'
    AND tipo = 'debito'
    AND ano_referencia IS NOT DISTINCT FROM v_mensalidade.ano_referencia
    AND mes_referencia IS NOT DISTINCT FROM v_mensalidade.mes_referencia
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.financeiro_lancamentos
    SET
      status = 'pago',
      data_pagamento = now(),
      metodo_pagamento = v_metodo_enum,
      valor_original = v_valor_pago,
      valor_multa = 0,
      valor_desconto = 0,
      descricao = v_descricao,
      created_by = v_user_id,
      updated_at = now()
    WHERE id = v_lancamento_id;
  ELSE
    INSERT INTO public.financeiro_lancamentos (
      escola_id,
      aluno_id,
      matricula_id,
      tipo,
      origem,
      descricao,
      valor_original,
      valor_multa,
      valor_desconto,
      status,
      data_vencimento,
      data_pagamento,
      metodo_pagamento,
      created_by,
      mes_referencia,
      ano_referencia
    ) VALUES (
      v_mensalidade.escola_id,
      v_mensalidade.aluno_id,
      v_mensalidade.matricula_id,
      'debito',
      'mensalidade',
      v_descricao,
      v_valor_pago,
      0,
      0,
      'pago',
      v_mensalidade.data_vencimento,
      now(),
      v_metodo_enum,
      v_user_id,
      v_mensalidade.mes_referencia,
      v_mensalidade.ano_referencia
    );
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    v_mensalidade.escola_id,
    v_user_id,
    'PAGAMENTO_REGISTRADO',
    'mensalidades',
    p_mensalidade_id::text,
    'financeiro',
    jsonb_build_object(
        'metodo', p_metodo_pagamento,
        'obs', p_observacao,
        'valor_pago', v_valor_pago,
        'aluno_id', v_mensalidade.aluno_id,
        'matricula_id', v_mensalidade.matricula_id
    ),
    jsonb_build_object('status', v_mensalidade.status),
    jsonb_build_object('status', 'pago')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor', v_valor_pago,
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamento_secretaria(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_mensalidade_id uuid,
  p_valor numeric,
  p_metodo public.pagamento_metodo,
  p_reference text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_status public.pagamento_status;
  v_legacy_metodo text;
  v_registro jsonb;
  v_ordem jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_metodo = 'cash' THEN
    v_status := 'settled';
  ELSE
    v_status := 'pending';
  END IF;

  IF p_metodo = 'tpa' AND (p_reference IS NULL OR length(trim(p_reference)) = 0) THEN
    RAISE EXCEPTION 'reference_required_for_tpa';
  END IF;

  IF p_metodo = 'transfer' AND (p_evidence_url IS NULL OR length(trim(p_evidence_url)) = 0) THEN
    RAISE EXCEPTION 'evidence_required_for_transfer';
  END IF;

  IF p_mensalidade_id IS NOT NULL THEN
    v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
      p_escola_id,
      p_aluno_id,
      p_mensalidade_id
    );

    IF COALESCE((v_ordem->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_ordem->>'message', 'Existe uma mensalidade anterior em aberto.');
    END IF;
  END IF;

  v_legacy_metodo := CASE p_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
    ELSE 'dinheiro'
  END;

  INSERT INTO public.pagamentos (
    escola_id,
    aluno_id,
    mensalidade_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    reference,
    evidence_url,
    gateway_ref,
    created_by,
    settled_at,
    settled_by,
    meta
  ) VALUES (
    p_escola_id,
    p_aluno_id,
    p_mensalidade_id,
    p_valor,
    CURRENT_DATE,
    p_metodo,
    v_legacy_metodo,
    v_status,
    p_reference,
    p_evidence_url,
    p_gateway_ref,
    auth.uid(),
    CASE WHEN v_status = 'settled' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'settled' THEN auth.uid() ELSE NULL END,
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  IF v_status = 'settled' AND p_mensalidade_id IS NOT NULL THEN
    SELECT public.registrar_pagamento(
      p_mensalidade_id,
      v_legacy_metodo,
      COALESCE(p_meta->>'observacao', 'Pagamento via balcão')
    ) INTO v_registro;

    IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_registro->>'erro', 'mensalidade_update_failed');
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_settle_pagamento(
  p_escola_id uuid,
  p_pagamento_id uuid,
  p_settle_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_mensalidade_status text;
  v_legacy_metodo text;
  v_registro jsonb;
  v_ordem jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.pagamentos
  SET status = 'settled',
      settled_at = now(),
      settled_by = auth.uid(),
      meta = meta || jsonb_build_object('settle_meta', COALESCE(p_settle_meta, '{}'::jsonb))
  WHERE id = p_pagamento_id
    AND escola_id = p_escola_id
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_pending';
  END IF;

  IF v_row.mensalidade_id IS NOT NULL THEN
    v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
      p_escola_id,
      v_row.aluno_id,
      v_row.mensalidade_id
    );

    IF COALESCE((v_ordem->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_ordem->>'message', 'Existe uma mensalidade anterior em aberto.');
    END IF;

    SELECT status INTO v_mensalidade_status
    FROM public.mensalidades
    WHERE id = v_row.mensalidade_id;

    IF v_mensalidade_status IS DISTINCT FROM 'pago' THEN
      v_legacy_metodo := CASE v_row.metodo
        WHEN 'cash' THEN 'dinheiro'
        WHEN 'tpa' THEN 'tpa'
        WHEN 'transfer' THEN 'transferencia'
        WHEN 'mcx' THEN 'multicaixa'
        WHEN 'kwik' THEN 'multicaixa'
        ELSE 'dinheiro'
      END;

      SELECT public.registrar_pagamento(
        v_row.mensalidade_id,
        v_legacy_metodo,
        COALESCE(p_settle_meta->>'observacao', 'Pagamento conciliado')
      ) INTO v_registro;

      IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION '%', COALESCE(v_registro->>'erro', 'mensalidade_update_failed');
      END IF;
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

COMMIT;
