BEGIN;

DROP FUNCTION IF EXISTS public.validar_pagamento(uuid, boolean);

CREATE INDEX IF NOT EXISTS idx_pagamentos_pending_queue
  ON public.pagamentos (escola_id, created_at DESC, id)
  WHERE status = 'pending';

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
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_recibo jsonb := '{}'::jsonb;
  v_valor_esperado numeric(14,2);
  v_valor_pago_atual numeric(14,2);
  v_novo_valor_pago numeric(14,2);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: tenant_not_resolved';
  END IF;

  IF p_pagamento_id IS NULL THEN
    RAISE EXCEPTION 'DATA: pagamento_id obrigatório';
  END IF;

  IF p_aprovado IS NULL THEN
    RAISE EXCEPTION 'DATA: parâmetro p_aprovado obrigatório';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'financeiro', 'secretaria_financeiro', 'admin_financeiro', 'admin_escola', 'admin', 'staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  IF v_pagamento.mensalidade_id IS NULL THEN
    RAISE EXCEPTION 'DATA: pagamento sem mensalidade associada';
  END IF;

  SELECT *
    INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = v_pagamento.mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade associada não encontrada';
  END IF;

  IF v_mensalidade.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: mensalidade fora do tenant';
  END IF;

  IF NOT p_aprovado THEN
    IF COALESCE(NULLIF(trim(p_mensagem_secretaria), ''), '') = '' THEN
      RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
    END IF;
  END IF;

  IF v_pagamento.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'status_atual', v_pagamento.status,
      'mensalidade_id', v_pagamento.mensalidade_id
    );
  END IF;

  IF p_aprovado THEN
    IF COALESCE(v_pagamento.valor_pago, 0) <= 0 THEN
      RAISE EXCEPTION 'DATA: valor do pagamento inválido';
    END IF;

    v_valor_esperado := COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0);
    v_valor_pago_atual := COALESCE(v_mensalidade.valor_pago_total, 0);
    v_novo_valor_pago := v_valor_pago_atual + COALESCE(v_pagamento.valor_pago, 0);

    IF v_novo_valor_pago > v_valor_esperado + 0.01 THEN
      DECLARE
        v_outros_pendentes int;
      BEGIN
        SELECT count(*) INTO v_outros_pendentes
        FROM public.pagamentos
        WHERE mensalidade_id = v_pagamento.mensalidade_id
          AND status = 'pending'
          AND id <> p_pagamento_id;
        
        IF v_outros_pendentes > 0 THEN
          RAISE EXCEPTION 'DATA: pagamento excede saldo pendente (% outros pendentes)', v_outros_pendentes;
        ELSE
          RAISE EXCEPTION 'DATA: pagamento excede saldo pendente';
        END IF;
      END;
    END IF;

    UPDATE public.pagamentos
    SET status = 'settled',
        settled_at = COALESCE(settled_at, now()),
        settled_by = v_actor_id,
        updated_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'validacao',
          jsonb_build_object(
            'aprovado', true,
            'validator_user_id', v_actor_id,
            'validated_at', now(),
            'mensagem_secretaria', NULLIF(trim(p_mensagem_secretaria), '')
          )
        )
    WHERE id = v_pagamento.id
    RETURNING * INTO v_pagamento;

    UPDATE public.mensalidades
    SET status = CASE
          WHEN v_novo_valor_pago >= v_valor_esperado THEN 'pago'
          ELSE 'pago_parcial'
        END,
        valor_pago_total = v_novo_valor_pago,
        data_pagamento_efetiva = CASE
          WHEN v_novo_valor_pago >= v_valor_esperado
            THEN COALESCE(data_pagamento_efetiva, v_pagamento.settled_at::date, current_date)
          ELSE data_pagamento_efetiva
        END,
        metodo_pagamento = COALESCE(v_pagamento.metodo, v_pagamento.metodo_pagamento, metodo_pagamento),
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = v_mensalidade.id
    RETURNING * INTO v_mensalidade;

    IF v_novo_valor_pago >= v_valor_esperado THEN
      v_recibo := public.emitir_recibo(v_mensalidade.id);
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'pagamento_id', v_pagamento.id,
      'mensalidade_id', v_mensalidade.id,
      'status', CASE WHEN v_novo_valor_pago >= v_valor_esperado THEN 'aprovado' ELSE 'aprovado_parcial' END,
      'valor_pago_total', v_novo_valor_pago,
      'valor_esperado', v_valor_esperado,
      'recibo', v_recibo
    );
  END IF;

  UPDATE public.pagamentos
  SET status = 'rejected',
      settled_at = NULL,
      settled_by = NULL,
      updated_at = now(),
      meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'validacao',
          jsonb_build_object(
            'aprovado', false,
            'validator_user_id', v_actor_id,
            'validated_at', now(),
            'mensagem_secretaria', NULLIF(trim(p_mensagem_secretaria), '')
          )
      )
  WHERE id = v_pagamento.id
  RETURNING * INTO v_pagamento;

  RETURN jsonb_build_object(
    'ok', true,
    'pagamento_id', v_pagamento.id,
    'mensalidade_id', v_pagamento.mensalidade_id,
    'status', 'rejeitado'
  );
END;
$$;

ALTER FUNCTION public.validar_pagamento(uuid, boolean, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.validar_pagamento(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_pagamento(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pagamento(uuid, boolean, text) TO service_role;

COMMIT;
