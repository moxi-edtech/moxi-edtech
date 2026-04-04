BEGIN;

CREATE INDEX IF NOT EXISTS idx_pagamentos_pending_queue
  ON public.pagamentos (escola_id, created_at DESC, id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.validar_pagamento(
  p_pagamento_id uuid,
  p_aprovado boolean
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
    IF v_mensalidade.status = 'pago' THEN
      RAISE EXCEPTION 'DATA: mensalidade já paga';
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
            'validated_at', now()
          )
        )
    WHERE id = v_pagamento.id
    RETURNING * INTO v_pagamento;

    UPDATE public.mensalidades
    SET status = 'pago',
        valor_pago_total = COALESCE(valor_pago_total, 0) + COALESCE(v_pagamento.valor_pago, 0),
        data_pagamento_efetiva = COALESCE(data_pagamento_efetiva, v_pagamento.settled_at::date, current_date),
        metodo_pagamento = COALESCE(v_pagamento.metodo, v_pagamento.metodo_pagamento, metodo_pagamento),
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = v_mensalidade.id
    RETURNING * INTO v_mensalidade;

    v_recibo := public.emitir_recibo(v_mensalidade.id);

    RETURN jsonb_build_object(
      'ok', true,
      'pagamento_id', v_pagamento.id,
      'mensalidade_id', v_mensalidade.id,
      'status', 'aprovado',
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
          'validated_at', now()
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

ALTER FUNCTION public.validar_pagamento(uuid, boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.validar_pagamento(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_pagamento(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pagamento(uuid, boolean) TO service_role;

COMMIT;
