BEGIN;

CREATE OR REPLACE FUNCTION public.reverter_pagamento_realizado(
  p_pagamento_id uuid,
  p_motivo text,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_motivo text := NULLIF(btrim(p_motivo), '');
  v_valor_pagamento numeric(14,2);
  v_valor_previsto numeric(14,2);
  v_valor_pago_anterior numeric(14,2);
  v_valor_pago_novo numeric(14,2);
  v_status_novo text;
  v_estorno_id uuid := NULL;
BEGIN
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated_or_tenant_not_resolved';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo obrigatório para reversão';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'financeiro', 'admin_financeiro', 'secretaria_financeiro', 'admin_escola', 'admin', 'staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF v_pagamento.id IS NULL THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  IF v_pagamento.status IN ('voided', 'estornado') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'status', v_pagamento.status
    );
  END IF;

  IF v_pagamento.status NOT IN ('settled', 'concluido', 'pago') THEN
    RAISE EXCEPTION 'STATE: apenas pagamentos realizados podem ser revertidos';
  END IF;

  v_valor_pagamento := COALESCE(v_pagamento.valor_pago, 0);
  IF v_valor_pagamento <= 0 THEN
    RAISE EXCEPTION 'DATA: valor do pagamento inválido para reversão';
  END IF;

  IF v_pagamento.mensalidade_id IS NOT NULL THEN
    SELECT *
      INTO v_mensalidade
    FROM public.mensalidades
    WHERE id = v_pagamento.mensalidade_id
    FOR UPDATE;

    IF v_mensalidade.id IS NULL THEN
      RAISE EXCEPTION 'DATA: mensalidade associada não encontrada';
    END IF;

    IF v_mensalidade.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: mensalidade cross_tenant_forbidden';
    END IF;

    v_valor_previsto := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
    v_valor_pago_anterior := COALESCE(v_mensalidade.valor_pago_total, 0);
    v_valor_pago_novo := GREATEST(v_valor_pago_anterior - v_valor_pagamento, 0);
    v_status_novo := CASE
      WHEN v_valor_pago_novo <= 0 THEN 'pendente'
      WHEN v_valor_pago_novo >= v_valor_previsto THEN 'pago'
      ELSE 'pago_parcial'
    END;

    INSERT INTO public.financeiro_estornos (
      escola_id,
      mensalidade_id,
      valor,
      motivo,
      created_by
    ) VALUES (
      v_escola_id,
      v_mensalidade.id,
      v_valor_pagamento,
      v_motivo,
      v_actor_id
    )
    RETURNING id INTO v_estorno_id;

    UPDATE public.mensalidades
    SET
      status = v_status_novo,
      valor_pago_total = v_valor_pago_novo,
      data_pagamento_efetiva = CASE WHEN v_valor_pago_novo <= 0 THEN NULL ELSE data_pagamento_efetiva END,
      metodo_pagamento = CASE WHEN v_valor_pago_novo <= 0 THEN NULL ELSE metodo_pagamento END,
      observacao = concat_ws(
        ' ',
        NULLIF(observacao, ''),
        '[REVERSAO_PAGAMENTO]',
        v_motivo
      ),
      updated_at = now(),
      updated_by = v_actor_id
    WHERE id = v_mensalidade.id;
  END IF;

  UPDATE public.pagamentos
  SET
    status = 'voided',
    updated_at = now(),
    settled_at = NULL,
    settled_by = NULL,
    meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
      'reversao',
      jsonb_build_object(
        'motivo', v_motivo,
        'actor_id', v_actor_id,
        'reversed_at', now(),
        'estorno_id', v_estorno_id,
        'valor_revertido', v_valor_pagamento,
        'idempotency_key', NULLIF(btrim(p_idempotency_key), '')
      )
    )
  WHERE id = v_pagamento.id;

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    action,
    entity,
    entity_id,
    portal,
    details,
    before,
    after
  ) VALUES (
    v_escola_id,
    v_actor_id,
    'PAGAMENTO_REVERTIDO',
    'pagamentos',
    v_pagamento.id::text,
    'financeiro',
    jsonb_build_object(
      'motivo', v_motivo,
      'valor_revertido', v_valor_pagamento,
      'mensalidade_id', v_pagamento.mensalidade_id,
      'estorno_id', v_estorno_id
    ),
    jsonb_build_object(
      'status', v_pagamento.status,
      'settled_at', v_pagamento.settled_at,
      'settled_by', v_pagamento.settled_by
    ),
    jsonb_build_object(
      'status', 'voided',
      'mensalidade_status', v_status_novo,
      'mensalidade_valor_pago_total', v_valor_pago_novo
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pagamento_id', v_pagamento.id,
    'mensalidade_id', v_pagamento.mensalidade_id,
    'estorno_id', v_estorno_id,
    'status', 'voided',
    'mensalidade_status', v_status_novo,
    'valor_pago_total', v_valor_pago_novo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverter_pagamento_realizado(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverter_pagamento_realizado(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_pagamento_realizado(uuid, text, text) TO service_role;

COMMIT;
