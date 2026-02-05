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

  v_taxa := COALESCE(v_serv.valor_base, 0);
  v_total := v_taxa;

  -- TODO: calcular débitos reais do aluno
  v_debitos := 0;

  IF v_serv.pode_bloquear_por_debito AND v_debitos > 0 THEN
    v_decision := 'BLOCKED';
    v_reason_code := 'DEBITOS_PENDENTES';
    v_reason_detail := 'Aluno possui débitos pendentes.';
  END IF;

  IF v_decision IS NULL AND v_serv.exige_aprovacao THEN
    -- TODO: validar aprovação acadêmica conforme contexto
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
    escola_id, aluno_id, servico_escola_id,
    status, reason_code, reason_detail,
    servico_codigo, servico_nome, valor_cobrado,
    contexto
  ) VALUES (
    v_escola_id, p_aluno_id, v_serv.id,
    v_pedido_status,
    v_reason_code, v_reason_detail,
    v_serv.codigo, v_serv.nome, v_total,
    p_contexto
  )
  RETURNING id INTO v_pedido_id;

  IF v_decision = 'REQUIRES_PAYMENT' THEN
    INSERT INTO public.pagamento_intents (
      escola_id, aluno_id, servico_pedido_id,
      amount, method, status, currency
    ) VALUES (
      v_escola_id, p_aluno_id, v_pedido_id,
      v_total, 'cash', 'draft', 'AOA'
    )
    RETURNING id INTO v_intent_id;
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
  v_int public.pagamento_intents%ROWTYPE;
  v_new_status text;
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

  IF p_method NOT IN ('cash','tpa','transfer','mcx','kiwk') THEN
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
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_SET';
  END IF;

  IF NOT user_has_role_in_school(v_escola_id, array['admin','secretaria']::text[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

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

  RETURN jsonb_build_object('ok', true);
END;
$$;
