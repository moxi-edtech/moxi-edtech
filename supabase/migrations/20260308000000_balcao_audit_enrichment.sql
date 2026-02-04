BEGIN;

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

CREATE OR REPLACE FUNCTION public.balcao_criar_pedido_e_decidir(
  p_servico_codigo text,
  p_aluno_id uuid,
  p_contexto jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_escola_id uuid := current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_serv public.servicos_escola%ROWTYPE;
  v_total numeric(12,0) := 0;
  v_debitos numeric(12,0) := 0;
  v_taxa numeric(12,0) := 0;
  v_decision text;
  v_reason_code text;
  v_reason_detail text;
  v_pedido_id uuid;
  v_intent_id uuid;
  v_requires_payment boolean := false;
  v_required_actions jsonb := '[]'::jsonb;
  v_pedido_status text;
  v_matricula_id uuid;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  IF NOT user_has_role_in_school(v_escola_id, array['admin','secretaria']::text[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT * INTO v_serv
  FROM public.servicos_escola
  WHERE escola_id = v_escola_id
    AND codigo = p_servico_codigo
    AND ativo IS TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICO_NAO_ENCONTRADO';
  END IF;

  SELECT id INTO v_matricula_id
  FROM public.matriculas
  WHERE escola_id = v_escola_id
    AND aluno_id = p_aluno_id
    AND status IN ('ativa','ativo')
  LIMIT 1;

  v_taxa := COALESCE(v_serv.valor_base, 0);
  v_total := v_taxa;

  v_debitos := 0;

  IF v_serv.pode_bloquear_por_debito AND v_debitos > 0 THEN
    v_decision := 'BLOCKED';
    v_reason_code := 'DEBITOS_PENDENTES';
    v_reason_detail := 'Aluno possui débitos pendentes.';
  END IF;

  IF v_decision IS NULL AND v_serv.exige_aprovacao THEN
    NULL;
  END IF;

  IF v_decision IS NULL THEN
    IF v_taxa > 0 OR v_serv.exige_pagamento_antes_de_liberar THEN
      v_requires_payment := true;
    END IF;

    IF v_serv.pode_bloquear_por_debito AND v_debitos > 0 THEN
      v_requires_payment := true;
      v_required_actions := v_required_actions || jsonb_build_array(
        jsonb_build_object('type','PAY_DEBITS','amount',v_debitos)
      );
      v_total := v_total + v_debitos;
    END IF;

    IF v_requires_payment THEN
      v_decision := 'REQUIRES_PAYMENT';
      v_required_actions := v_required_actions || jsonb_build_array(
        jsonb_build_object('type','PAY_SERVICE_FEE','amount',v_taxa)
      );
    ELSE
      v_decision := 'GRANTED';
    END IF;
  END IF;

  v_pedido_status := CASE
    WHEN v_decision = 'REQUIRES_PAYMENT' THEN
      CASE WHEN v_serv.aceita_pagamento_pendente THEN 'granted' ELSE 'pending_payment' END
    WHEN v_decision = 'GRANTED' THEN 'granted'
    ELSE 'blocked'
  END;

  INSERT INTO public.servico_pedidos (
    escola_id, aluno_id, matricula_id, servico_escola_id,
    status, reason_code, reason_detail,
    servico_codigo, servico_nome, valor_cobrado,
    contexto
  ) VALUES (
    v_escola_id, p_aluno_id, v_matricula_id, v_serv.id,
    v_pedido_status,
    v_reason_code, v_reason_detail,
    v_serv.codigo, v_serv.nome, v_total,
    p_contexto
  )
  RETURNING id INTO v_pedido_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'BALCAO_SERVICO_PEDIDO',
    'servico_pedidos',
    v_pedido_id::text,
    'secretaria',
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'matricula_id', v_matricula_id,
      'servico_codigo', v_serv.codigo,
      'servico_nome', v_serv.nome,
      'decision', v_decision,
      'total', v_total
    )
  );

  IF v_decision = 'REQUIRES_PAYMENT' THEN
    INSERT INTO public.pagamento_intents (
      escola_id, aluno_id, servico_pedido_id,
      amount, method, status, currency
    ) VALUES (
      v_escola_id, p_aluno_id, v_pedido_id,
      v_total, 'cash', 'draft', 'AOA'
    )
    RETURNING id INTO v_intent_id;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      'BALCAO_PAGAMENTO_INTENT',
      'pagamento_intents',
      v_intent_id::text,
      'secretaria',
      jsonb_build_object(
        'aluno_id', p_aluno_id,
        'matricula_id', v_matricula_id,
        'pedido_id', v_pedido_id,
        'amount', v_total,
        'status', 'draft'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'decision', v_decision,
    'pedido_id', v_pedido_id,
    'payment_intent_id', v_intent_id,
    'required_actions', v_required_actions,
    'amounts', jsonb_build_object('debitos', v_debitos, 'taxa', v_taxa, 'total', v_total),
    'reason_code', v_reason_code,
    'reason_detail', v_reason_detail
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.balcao_confirmar_pagamento_intent(
  p_intent_id uuid,
  p_method text,
  p_reference text DEFAULT NULL,
  p_terminal_id text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_escola_id uuid := current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_int public.pagamento_intents%ROWTYPE;
  v_new_status text;
  v_matricula_id uuid;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  IF NOT user_has_role_in_school(v_escola_id, array['admin','secretaria','financeiro']::text[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT * INTO v_int
  FROM public.pagamento_intents
  WHERE id = p_intent_id
    AND escola_id = v_escola_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTENT_NOT_FOUND';
  END IF;

  IF v_int.status IN ('settled','canceled') THEN
    RAISE EXCEPTION 'INTENT_ALREADY_FINAL';
  END IF;

  IF p_method NOT IN ('cash','tpa','transfer','mcx','kwik','kiwk') THEN
    RAISE EXCEPTION 'METHOD_INVALID';
  END IF;

  IF p_method = 'cash' THEN
    v_new_status := 'settled';
  ELSIF p_method = 'tpa' THEN
    IF COALESCE(p_reference,'') = '' THEN
      RAISE EXCEPTION 'TPA_REFERENCE_REQUIRED';
    END IF;
    v_new_status := 'pending';
  ELSIF p_method = 'transfer' THEN
    IF COALESCE(p_evidence_url,'') = '' THEN
      RAISE EXCEPTION 'TRANSFER_EVIDENCE_REQUIRED';
    END IF;
    v_new_status := 'pending';
  ELSIF p_method = 'mcx' THEN
    IF COALESCE(p_reference,'') = '' THEN
      RAISE EXCEPTION 'MCX_REFERENCE_REQUIRED';
    END IF;
    v_new_status := 'pending';
  ELSIF p_method = 'kwik' THEN
    v_new_status := 'pending';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.pagamento_intents
  SET method = p_method,
      status = v_new_status,
      reference = COALESCE(p_reference, reference),
      terminal_id = COALESCE(p_terminal_id, terminal_id),
      evidence_url = COALESCE(p_evidence_url, evidence_url),
      meta = meta || p_meta,
      settled_at = CASE WHEN v_new_status = 'settled' THEN now() ELSE NULL END
  WHERE id = p_intent_id;

  IF v_new_status = 'settled' AND v_int.servico_pedido_id IS NOT NULL THEN
    UPDATE public.servico_pedidos
    SET status = 'granted'
    WHERE id = v_int.servico_pedido_id
      AND escola_id = v_escola_id
      AND status = 'pending_payment';
  END IF;

  SELECT matricula_id INTO v_matricula_id
  FROM public.servico_pedidos
  WHERE id = v_int.servico_pedido_id
  LIMIT 1;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'BALCAO_PAGAMENTO_CONFIRMADO',
    'pagamento_intents',
    v_int.id::text,
    'secretaria',
    jsonb_build_object(
      'aluno_id', v_int.aluno_id,
      'matricula_id', v_matricula_id,
      'pedido_id', v_int.servico_pedido_id,
      'method', p_method,
      'status', v_new_status,
      'amount', v_int.amount,
      'reference', p_reference,
      'evidence_url', p_evidence_url
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.balcao_cancelar_pedido(
  p_pedido_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_escola_id uuid := current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_aluno_id uuid;
  v_matricula_id uuid;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  IF NOT user_has_role_in_school(v_escola_id, array['admin','secretaria']::text[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT aluno_id, matricula_id
    INTO v_aluno_id, v_matricula_id
  FROM public.servico_pedidos
  WHERE id = p_pedido_id
    AND escola_id = v_escola_id;

  UPDATE public.servico_pedidos
  SET status = 'canceled',
      reason_code = COALESCE(reason_code, 'CANCELED'),
      reason_detail = COALESCE(p_reason, reason_detail)
  WHERE id = p_pedido_id
    AND escola_id = v_escola_id
    AND status IN ('blocked','pending_payment','granted');

  UPDATE public.pagamento_intents
  SET status = 'canceled'
  WHERE escola_id = v_escola_id
    AND servico_pedido_id = p_pedido_id
    AND status IN ('draft','pending');

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'BALCAO_PEDIDO_CANCELADO',
    'servico_pedidos',
    p_pedido_id::text,
    'secretaria',
    jsonb_build_object(
      'aluno_id', v_aluno_id,
      'matricula_id', v_matricula_id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;
