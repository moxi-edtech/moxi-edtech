-- P0: guard the existing canonical monthly/service payment validator against
-- replayed approvals and concurrent opposite decisions.
-- All original AUTH/tenant guards, receipt logic, fiscal behavior, signatures,
-- metadata and grants are preserved from 20270605120000.
-- The repository has future-dated 2027 migrations: this fix must be later
-- than 20271015100000 or the original function would overwrite it.
-- Rollout remains GATED by a disposable regression and explicit approval.
CREATE OR REPLACE FUNCTION public.validar_pagamento(
  p_pagamento_id uuid,
  p_aprovado boolean,
  p_mensagem_secretaria text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  -- Para Mensalidade
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_recibo jsonb := '{}'::jsonb;
  v_valor_esperado numeric(14,2);
  v_valor_pago_atual numeric(14,2);
  v_novo_valor_pago numeric(14,2);
  -- Para Serviço
  v_intent public.pagamento_intents%ROWTYPE;
BEGIN
  -- 1. Validação Básica
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated_or_tenant_not_resolved';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'financeiro', 'secretaria_financeiro', 'admin_financeiro', 'admin_escola', 'admin', 'staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  -- 2. Identificar se é Pagamento (Mensalidade) ou Intent (Serviço)
  SELECT * INTO v_pagamento FROM public.pagamentos WHERE id = p_pagamento_id FOR UPDATE;

  IF v_pagamento.id IS NOT NULL THEN
    -- ==========================================
    -- LÓGICA MENSALIDADE
    -- ==========================================
    IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
    END IF;

    -- We hold the payment row's FOR UPDATE lock until commit. Every retry,
    -- parallel approval, or conflicting rejection MUST observe the state
    -- produced by the first committed transaction. No second ledger write.
    IF v_pagamento.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'STATE: pagamento_ja_processado';
    END IF;

    IF v_pagamento.mensalidade_id IS NULL THEN
      RAISE EXCEPTION 'DATA: pagamento sem mensalidade associada';
    END IF;

    SELECT * INTO v_mensalidade FROM public.mensalidades WHERE id = v_pagamento.mensalidade_id FOR UPDATE;

    IF NOT p_aprovado THEN
      IF COALESCE(NULLIF(trim(p_mensagem_secretaria), ''), '') = '' THEN
        RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
      END IF;

      UPDATE public.pagamentos
      SET status = 'rejected',
          updated_at = now(),
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
              'validacao', jsonb_build_object('aprovado', false, 'validator_user_id', v_actor_id, 'validated_at', now(), 'mensagem_secretaria', p_mensagem_secretaria)
          )
      WHERE id = p_pagamento_id;

      RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'pagamento_id', p_pagamento_id);
    END IF;

    -- Aprovar Mensalidade
    IF COALESCE(v_pagamento.valor_pago, 0) <= 0 THEN
      RAISE EXCEPTION 'DATA: valor do pagamento inválido';
    END IF;

    v_valor_esperado := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
    v_valor_pago_atual := COALESCE(v_mensalidade.valor_pago_total, 0);

    -- Guard against a SECOND pending proof for an already fully-paid request.
    -- The mensalidade row is locked, so parallel approvals for distinct proof
    -- IDs cannot both increase the authoritative total beyond the debt.
    IF v_valor_esperado <= 0 OR v_valor_pago_atual >= v_valor_esperado THEN
      RAISE EXCEPTION 'STATE: mensalidade_ja_liquidada';
    END IF;
    v_novo_valor_pago := v_valor_pago_atual + COALESCE(v_pagamento.valor_pago, 0);
    IF v_novo_valor_pago > v_valor_esperado THEN
      RAISE EXCEPTION 'STATE: pagamento_excede_saldo_pendente';
    END IF;

    UPDATE public.pagamentos
    SET status = 'settled',
        settled_at = now(),
        settled_by = v_actor_id,
        updated_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'validacao', jsonb_build_object('aprovado', true, 'validator_user_id', v_actor_id, 'validated_at', now())
        )
    WHERE id = p_pagamento_id;

    UPDATE public.mensalidades
    SET status = CASE WHEN v_novo_valor_pago >= v_valor_esperado THEN 'pago' ELSE 'pago_parcial' END,
        valor_pago_total = v_novo_valor_pago,
        data_pagamento_efetiva = COALESCE(data_pagamento_efetiva, now()::date),
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = v_mensalidade.id;

    IF v_novo_valor_pago >= v_valor_esperado THEN
      v_recibo := public.emitir_recibo(v_mensalidade.id);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'status', CASE WHEN v_novo_valor_pago >= v_valor_esperado THEN 'approved' ELSE 'approved_parcial' END,
        'pagamento_id', p_pagamento_id,
        'recibo', v_recibo
    );

  ELSE
    -- ==========================================
    -- LÓGICA SERVIÇO (Balcão/Self-Service)
    -- ==========================================
    SELECT * INTO v_intent FROM public.pagamento_intents WHERE id = p_pagamento_id FOR UPDATE;

    IF v_intent.id IS NULL THEN
      RAISE EXCEPTION 'DATA: Pagamento não encontrado.';
    END IF;

    IF v_intent.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
    END IF;

    -- Keep the service side equally atomic; a settled service cannot later
    -- be canceled, and a rejected proof needs a new pending submission.
    IF v_intent.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'STATE: comprovativo_ja_processado';
    END IF;

    IF NOT p_aprovado THEN
      IF COALESCE(NULLIF(trim(p_mensagem_secretaria), ''), '') = '' THEN
        RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
      END IF;

      UPDATE public.pagamento_intents
      SET status = 'failed',
          meta = meta || jsonb_build_object('reject_reason', p_mensagem_secretaria, 'validated_at', now(), 'validator_user_id', v_actor_id)
      WHERE id = p_pagamento_id;

      UPDATE public.servico_pedidos SET status = 'canceled' WHERE id = v_intent.servico_pedido_id;

      RETURN jsonb_build_object('ok', true, 'status', 'rejected', 'pagamento_id', p_pagamento_id);
    END IF;

    -- Aprovar Serviço
    UPDATE public.pagamento_intents
    SET status = 'settled',
        settled_at = now(),
        meta = meta || jsonb_build_object('confirmed_via', 'portal_validacao_recebimentos', 'validated_at', now(), 'validator_user_id', v_actor_id)
    WHERE id = p_pagamento_id;

    UPDATE public.servico_pedidos
    SET status = 'granted'
    WHERE id = v_intent.servico_pedido_id;

    RETURN jsonb_build_object('ok', true, 'status', 'approved', 'pagamento_id', p_pagamento_id);
  END IF;
END;
$$;
