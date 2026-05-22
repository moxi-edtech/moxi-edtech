BEGIN;

DROP FUNCTION IF EXISTS public.registrar_pagamento(uuid, text, text);

CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_mensalidade_id uuid,
  p_metodo_pagamento text,
  p_observacao text DEFAULT NULL::text,
  p_valor_pago numeric DEFAULT NULL::numeric,
  p_promessa_liquidacao date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_valor_a_registrar numeric;
  v_novo_total_pago numeric;
  v_lancamento_id uuid;
  v_metodo_enum public.metodo_pagamento_enum;
  v_descricao text;
  v_novo_status text;
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

  v_valor_a_registrar := COALESCE(
    p_valor_pago,
    (COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) - COALESCE(v_mensalidade.valor_pago_total, 0))
  );

  IF v_valor_a_registrar <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Valor de pagamento deve ser maior que zero.');
  END IF;

  v_novo_total_pago := COALESCE(v_mensalidade.valor_pago_total, 0) + v_valor_a_registrar;

  IF v_novo_total_pago > COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) + 0.01 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Valor pago excede o valor previsto da mensalidade.');
  END IF;

  v_novo_status := CASE
    WHEN v_novo_total_pago < (COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) - 0.01) THEN 'pago_parcial'
    ELSE 'pago'
  END;

  UPDATE public.mensalidades
  SET
    status = v_novo_status,
    valor_pago_total = v_novo_total_pago,
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = COALESCE(p_observacao, observacao),
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  v_metodo_enum := CASE lower(coalesce(p_metodo_pagamento, ''))
    WHEN 'dinheiro' THEN 'numerario'::public.metodo_pagamento_enum
    WHEN 'numerario' THEN 'numerario'::public.metodo_pagamento_enum
    WHEN 'tpa' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'tpa_fisico' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'multicaixa' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'transferencia' THEN 'transferencia'::public.metodo_pagamento_enum
    WHEN 'mbway' THEN 'deposito'::public.metodo_pagamento_enum
    WHEN 'referencia' THEN 'deposito'::public.metodo_pagamento_enum
    WHEN 'deposito' THEN 'deposito'::public.metodo_pagamento_enum
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
      status = CASE WHEN v_novo_status = 'pago' THEN 'pago'::public.financeiro_status ELSE 'parcial'::public.financeiro_status END,
      data_pagamento = now(),
      metodo_pagamento = v_metodo_enum,
      updated_at = now()
    WHERE id = v_lancamento_id;
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
      'valor_pago', v_valor_a_registrar,
      'novo_total_pago', v_novo_total_pago,
      'promessa', p_promessa_liquidacao,
      'aluno_id', v_mensalidade.aluno_id,
      'matricula_id', v_mensalidade.matricula_id
    ),
    jsonb_build_object('status', v_mensalidade.status, 'valor_pago_total', v_mensalidade.valor_pago_total),
    jsonb_build_object('status', v_novo_status, 'valor_pago_total', v_novo_total_pago)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor_registrado', v_valor_a_registrar,
    'novo_total_pago', v_novo_total_pago,
    'status', v_novo_status,
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$function$;

COMMIT;
