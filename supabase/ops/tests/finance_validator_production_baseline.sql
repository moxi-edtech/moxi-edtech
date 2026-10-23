CREATE OR REPLACE FUNCTION public.validar_pagamento(p_pagamento_id uuid, p_aprovado boolean, p_mensagem_secretaria text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_pagamento public.pagamentos%ROWTYPE;
  v_intent public.pagamento_intents%ROWTYPE;
  v_apply jsonb;
BEGIN
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated_or_tenant_not_resolved';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin_escola','admin','staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
      RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
    END IF;

    IF v_pagamento.mensalidade_id IS NULL THEN
      RAISE EXCEPTION 'DATA: pagamento sem mensalidade associada';
    END IF;

    IF NOT p_aprovado THEN
      IF COALESCE(NULLIF(btrim(p_mensagem_secretaria),''),'')='' THEN
        RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
      END IF;

      IF v_pagamento.status='rejected' THEN
        RETURN jsonb_build_object(
          'ok',true,'idempotent',true,'status','rejected','pagamento_id',v_pagamento.id
        );
      END IF;

      IF v_pagamento.status <> 'pending' THEN
        RAISE EXCEPTION 'STATE: apenas pagamento pendente pode ser rejeitado';
      END IF;

      UPDATE public.pagamentos
      SET status='rejected',
          updated_at=now(),
          meta=COALESCE(meta,'{}'::jsonb) ||
            jsonb_build_object(
              'validacao',
              jsonb_build_object(
                'aprovado',false,
                'validator_user_id',v_actor_id,
                'validated_at',now(),
                'mensagem_secretaria',p_mensagem_secretaria
              )
            )
      WHERE id=v_pagamento.id;

      RETURN jsonb_build_object(
        'ok',true,'idempotent',false,'status','rejected','pagamento_id',v_pagamento.id
      );
    END IF;

    IF v_pagamento.status='settled' THEN
      v_apply := public.financeiro_aplicar_pagamento_existente(v_pagamento.id,v_actor_id);
      RETURN jsonb_build_object(
        'ok',true,
        'idempotent',true,
        'status',CASE WHEN COALESCE(v_apply->>'mensalidade_status','')='pago'
          THEN 'approved' ELSE 'approved_parcial' END,
        'pagamento_id',v_pagamento.id,
        'allocation',v_apply
      );
    END IF;

    IF v_pagamento.status <> 'pending' THEN
      RAISE EXCEPTION 'STATE: pagamento não pode ser aprovado no estado actual';
    END IF;

    UPDATE public.pagamentos
    SET status='settled',
        settled_at=now(),
        settled_by=v_actor_id,
        updated_at=now(),
        meta=COALESCE(meta,'{}'::jsonb) ||
          jsonb_build_object(
            'validacao',
            jsonb_build_object(
              'aprovado',true,
              'validator_user_id',v_actor_id,
              'validated_at',now()
            )
          )
    WHERE id=v_pagamento.id;

    v_apply := public.financeiro_aplicar_pagamento_existente(v_pagamento.id,v_actor_id);

    RETURN jsonb_build_object(
      'ok',true,
      'idempotent',false,
      'status',CASE WHEN COALESCE(v_apply->>'mensalidade_status','')='pago'
        THEN 'approved' ELSE 'approved_parcial' END,
      'pagamento_id',v_pagamento.id,
      'allocation',v_apply
    );
  END IF;

  SELECT *
    INTO v_intent
  FROM public.pagamento_intents
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: Pagamento não encontrado.';
  END IF;

  IF v_intent.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  IF NOT p_aprovado THEN
    IF COALESCE(NULLIF(btrim(p_mensagem_secretaria),''),'')='' THEN
      RAISE EXCEPTION 'DATA: mensagem de rejeição obrigatória';
    END IF;

    UPDATE public.pagamento_intents
    SET status='failed',
        meta=COALESCE(meta,'{}'::jsonb) ||
          jsonb_build_object(
            'reject_reason',p_mensagem_secretaria,
            'validated_at',now(),
            'validator_user_id',v_actor_id
          )
    WHERE id=p_pagamento_id;

    UPDATE public.servico_pedidos
    SET status='canceled'
    WHERE id=v_intent.servico_pedido_id;

    RETURN jsonb_build_object(
      'ok',true,'status','rejected','pagamento_id',p_pagamento_id
    );
  END IF;

  IF v_intent.status='settled' THEN
    RETURN jsonb_build_object(
      'ok',true,'idempotent',true,'status','approved','pagamento_id',p_pagamento_id
    );
  END IF;

  UPDATE public.pagamento_intents
  SET status='settled',
      settled_at=now(),
      meta=COALESCE(meta,'{}'::jsonb) ||
        jsonb_build_object(
          'confirmed_via','portal_validacao_recebimentos',
          'validated_at',now(),
          'validator_user_id',v_actor_id
        )
  WHERE id=p_pagamento_id;

  UPDATE public.servico_pedidos
  SET status='granted'
  WHERE id=v_intent.servico_pedido_id;

  RETURN jsonb_build_object(
    'ok',true,'idempotent',false,'status','approved','pagamento_id',p_pagamento_id
  );
END;
$function$

