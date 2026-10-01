BEGIN;
CREATE OR REPLACE FUNCTION public.reverter_pagamento_realizado(p_pagamento_id uuid, p_motivo text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_motivo text := NULLIF(btrim(p_motivo),'');
  v_idem text := NULLIF(btrim(p_idempotency_key),'');
  v_reversao public.financeiro_pagamento_reversoes%ROWTYPE;
  v_app public.financeiro_pagamento_alocacoes%ROWTYPE;
  v_rev_alloc_id uuid;
  v_estorno_id uuid;
  v_expected numeric(18,2);
  v_paid_before numeric(18,2);
  v_paid_after numeric(18,2);
  v_status_after text;
BEGIN
  IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated_or_tenant_not_resolved';
  END IF;

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'DATA: motivo obrigatório para reversão';
  END IF;

  IF v_idem IS NULL THEN
    RAISE EXCEPTION 'DATA: idempotency_key obrigatória para reversão';
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria','financeiro','admin_financeiro','secretaria_financeiro','admin_escola','admin','staff_admin']
  ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  SELECT *
    INTO v_reversao
  FROM public.financeiro_pagamento_reversoes
  WHERE pagamento_id=v_pagamento.id
     OR idempotency_key=v_idem
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'pagamento_id',v_pagamento.id,
      'reversao_id',v_reversao.id,
      'status',v_pagamento.status
    );
  END IF;

  IF v_pagamento.status NOT IN ('settled','concluido','pago') THEN
    RAISE EXCEPTION 'STATE: apenas pagamentos realizados podem ser revertidos';
  END IF;

  INSERT INTO public.financeiro_pagamento_reversoes (
    escola_id,pagamento_id,motivo,idempotency_key,created_by,metadata
  )
  VALUES (
    v_pagamento.escola_id,v_pagamento.id,v_motivo,v_idem,v_actor_id,
    jsonb_build_object(
      'payment_status_before',v_pagamento.status,
      'valor_pago',v_pagamento.valor_pago,
      'fiscal_documento_id',v_pagamento.fiscal_documento_id,
      'fiscal_action_required',v_pagamento.fiscal_documento_id IS NOT NULL,
      'fiscal_action_owner','BILL-010'
    )
  )
  RETURNING * INTO v_reversao;

  FOR v_app IN
    SELECT a.*
    FROM public.financeiro_pagamento_alocacoes a
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id
          AND r.natureza='reversao'
      )
    ORDER BY a.created_at,a.id
    FOR UPDATE
  LOOP
    INSERT INTO public.financeiro_pagamento_alocacoes (
      escola_id,pagamento_id,mensalidade_id,fiscal_documento_origem_id,
      natureza,alocacao_origem_id,valor_bruto_aoa,valor_liquido_aoa,
      valor_imposto_aoa,idempotency_key,metadata,created_by
    )
    VALUES (
      v_app.escola_id,v_app.pagamento_id,v_app.mensalidade_id,
      v_app.fiscal_documento_origem_id,'reversao',v_app.id,
      v_app.valor_bruto_aoa,v_app.valor_liquido_aoa,v_app.valor_imposto_aoa,
      format('reversao:%s:alocacao:%s:v1',v_reversao.id,v_app.id),
      jsonb_build_object(
        'reversao_id',v_reversao.id,
        'motivo',v_motivo
      ),
      v_actor_id
    )
    RETURNING id INTO v_rev_alloc_id;

    IF v_app.mensalidade_id IS NOT NULL THEN
      SELECT *
        INTO v_mensalidade
      FROM public.mensalidades
      WHERE id=v_app.mensalidade_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'DATA: mensalidade da alocação não encontrada';
      END IF;

      v_expected := round(COALESCE(v_mensalidade.valor_previsto,v_mensalidade.valor,0)::numeric,2);
      v_paid_before := round(COALESCE(v_mensalidade.valor_pago_total,0)::numeric,2);

      IF v_paid_before + 0.01 < v_app.valor_bruto_aoa THEN
        RAISE EXCEPTION 'STATE: mensalidade possui saldo pago inferior à alocação a reverter';
      END IF;

      v_paid_after := GREATEST(round(v_paid_before-v_app.valor_bruto_aoa,2),0);
      v_status_after := CASE
        WHEN v_paid_after <= 0 THEN 'pendente'
        WHEN v_paid_after >= v_expected-0.01 THEN 'pago'
        ELSE 'pago_parcial'
      END;

      UPDATE public.mensalidades
      SET
        status=v_status_after,
        valor_pago_total=v_paid_after,
        data_pagamento_efetiva=CASE
          WHEN v_paid_after<=0 THEN NULL ELSE data_pagamento_efetiva
        END,
        metodo_pagamento=CASE
          WHEN v_paid_after<=0 THEN NULL ELSE metodo_pagamento
        END,
        observacao=concat_ws(
          ' ',
          NULLIF(observacao,''),
          '[REVERSAO_PAGAMENTO]',
          v_motivo
        ),
        updated_at=now(),
        updated_by=v_actor_id
      WHERE id=v_mensalidade.id;

      INSERT INTO public.financeiro_estornos (
        escola_id,mensalidade_id,valor,motivo,created_by,
        pagamento_id,alocacao_id,reversao_id,idempotency_key
      )
      VALUES (
        v_pagamento.escola_id,
        v_mensalidade.id,
        v_app.valor_bruto_aoa,
        v_motivo,
        v_actor_id,
        v_pagamento.id,
        v_rev_alloc_id,
        v_reversao.id,
        format('reversao:%s:mensalidade:%s:v1',v_reversao.id,v_mensalidade.id)
      )
      RETURNING id INTO v_estorno_id;
    END IF;
  END LOOP;

  UPDATE public.pagamentos
  SET
    status='voided',
    updated_at=now(),
    meta=COALESCE(meta,'{}'::jsonb) ||
      jsonb_build_object(
        'reversao',
        jsonb_build_object(
          'reversao_id',v_reversao.id,
          'motivo',v_motivo,
          'actor_id',v_actor_id,
          'reversed_at',now(),
          'idempotency_key',v_idem
        )
      )
  WHERE id=v_pagamento.id;

  INSERT INTO public.audit_logs (
    escola_id,actor_id,action,entity,entity_id,portal,details,before,after
  )
  VALUES (
    v_pagamento.escola_id,
    v_actor_id,
    'PAGAMENTO_REVERTIDO',
    'pagamentos',
    v_pagamento.id::text,
    'financeiro',
    jsonb_build_object(
      'reversao_id',v_reversao.id,
      'motivo',v_motivo,
      'valor_revertido',v_pagamento.valor_pago
    ),
    jsonb_build_object(
      'status',v_pagamento.status,
      'settled_at',v_pagamento.settled_at,
      'settled_by',v_pagamento.settled_by
    ),
    jsonb_build_object(
      'status','voided',
      'reversao_id',v_reversao.id
    )
  );

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'pagamento_id',v_pagamento.id,
    'reversao_id',v_reversao.id,
    'status','voided'
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.reverter_pagamento_realizado(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverter_pagamento_realizado(uuid,text,text) TO authenticated, service_role;
COMMIT;