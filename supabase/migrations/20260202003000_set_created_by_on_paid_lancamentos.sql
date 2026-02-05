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
BEGIN
  -- Lock otimista para evitar concorrência em múltiplas baixas
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

  -- Auditoria
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
        'valor_pago', v_valor_pago
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
