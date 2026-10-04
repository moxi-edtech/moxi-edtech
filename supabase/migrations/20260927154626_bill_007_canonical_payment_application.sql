BEGIN;

ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS idempotency_key text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pagamentos_escola_idempotency
  ON public.pagamentos(escola_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.financeiro_aplicar_pagamento_existente(p_pagamento_id uuid, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_existing public.financeiro_pagamento_alocacoes%ROWTYPE;
  v_source public.fiscal_documentos%ROWTYPE;
  v_actor uuid;
  v_expected numeric(18,2);
  v_current numeric(18,2);
  v_outstanding numeric(18,2);
  v_payment numeric(18,2);
  v_new_paid numeric(18,2);
  v_new_status text;
  v_alloc_id uuid;
  v_active_gross numeric(18,2) := 0;
  v_active_net numeric(18,2) := 0;
  v_active_tax numeric(18,2) := 0;
  v_remaining_gross numeric(18,2);
  v_remaining_net numeric(18,2);
  v_remaining_tax numeric(18,2);
  v_alloc_net numeric(18,2);
  v_alloc_tax numeric(18,2);
  v_ratio numeric(18,8);
  v_method_legacy text;
  v_lancamento_id uuid;
  v_source_mismatch boolean := false;
BEGIN
  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.status NOT IN ('settled','concluido','pago') THEN
    RAISE EXCEPTION 'STATE: pagamento precisa estar liquidado antes da aplicação';
  END IF;

  IF v_pagamento.mensalidade_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'mensalidade_id', null,
      'requires_rc', false,
      'reason', 'pagamento_sem_mensalidade'
    );
  END IF;

  SELECT *
    INTO v_existing
  FROM public.financeiro_pagamento_alocacoes
  WHERE pagamento_id = v_pagamento.id
    AND mensalidade_id = v_pagamento.mensalidade_id
    AND natureza = 'aplicacao'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'mensalidade_id', v_existing.mensalidade_id,
      'alocacao_id', v_existing.id,
      'fiscal_documento_origem_id', v_existing.fiscal_documento_origem_id,
      'requires_rc', v_existing.fiscal_documento_origem_id IS NOT NULL,
      'valor_bruto_aoa', v_existing.valor_bruto_aoa,
      'valor_liquido_aoa', v_existing.valor_liquido_aoa,
      'valor_imposto_aoa', v_existing.valor_imposto_aoa
    );
  END IF;

  SELECT *
    INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = v_pagamento.mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade associada não encontrada';
  END IF;

  IF v_mensalidade.escola_id IS DISTINCT FROM v_pagamento.escola_id
     OR v_mensalidade.aluno_id IS DISTINCT FROM v_pagamento.aluno_id THEN
    RAISE EXCEPTION 'AUTH: pagamento e mensalidade pertencem a contextos diferentes';
  END IF;

  v_actor := COALESCE(p_actor_id, v_pagamento.settled_by, v_pagamento.created_by);
  v_expected := round(COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0)::numeric, 2);
  v_current := round(COALESCE(v_mensalidade.valor_pago_total, 0)::numeric, 2);
  v_outstanding := GREATEST(round(v_expected - v_current, 2), 0);
  v_payment := round(COALESCE(v_pagamento.valor_pago, 0)::numeric, 2);

  IF v_payment <= 0 THEN
    RAISE EXCEPTION 'DATA: valor do pagamento inválido';
  END IF;

  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'STATE: mensalidade já não possui saldo por liquidar';
  END IF;

  IF v_payment > v_outstanding + 0.01 THEN
    RAISE EXCEPTION
      'DATA: valor do pagamento (%) excede saldo pendente da mensalidade (%)',
      v_payment, v_outstanding;
  END IF;

  IF v_mensalidade.fiscal_documento_id IS NOT NULL THEN
    SELECT *
      INTO v_source
    FROM public.fiscal_documentos
    WHERE id = v_mensalidade.fiscal_documento_id
      AND empresa_id IS NOT NULL
      AND tipo_documento IN ('FT','ND')
      AND status = 'emitido'
    FOR UPDATE;

    IF FOUND THEN
      SELECT
        COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_bruto_aoa ELSE -valor_bruto_aoa END),2),0),
        COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_liquido_aoa ELSE -valor_liquido_aoa END),2),0),
        COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_imposto_aoa ELSE -valor_imposto_aoa END),2),0)
      INTO v_active_gross, v_active_net, v_active_tax
      FROM public.financeiro_pagamento_alocacoes
      WHERE fiscal_documento_origem_id = v_source.id;

      v_remaining_gross := GREATEST(round(v_source.total_bruto_aoa::numeric - v_active_gross,2),0);
      v_remaining_net := GREATEST(round(v_source.total_liquido_aoa::numeric - v_active_net,2),0);
      v_remaining_tax := GREATEST(round(v_source.total_impostos_aoa::numeric - v_active_tax,2),0);

      IF v_remaining_gross <= 0 THEN
        RAISE EXCEPTION 'STATE: documento fiscal origem já se encontra integralmente regularizado';
      END IF;

      IF v_payment > v_remaining_gross + 0.01 THEN
        RAISE EXCEPTION
          'DATA: valor a regularizar (%) excede remanescente do documento fiscal origem (%)',
          v_payment, v_remaining_gross;
      END IF;

      v_source_mismatch := abs(v_expected - round(v_source.total_bruto_aoa::numeric,2)) > 0.01;

      IF abs(v_payment - v_remaining_gross) <= 0.01 THEN
        v_alloc_net := v_remaining_net;
        v_alloc_tax := v_remaining_tax;
      ELSE
        v_ratio := v_payment / NULLIF(v_remaining_gross,0);
        v_alloc_net := LEAST(v_remaining_net, round(v_remaining_net * v_ratio,2));
        v_alloc_tax := round(v_payment - v_alloc_net,2);

        IF v_alloc_tax > v_remaining_tax + 0.01 THEN
          v_alloc_tax := v_remaining_tax;
          v_alloc_net := round(v_payment - v_alloc_tax,2);
        END IF;
      END IF;

      IF v_alloc_net < 0 OR v_alloc_tax < 0
         OR abs(round(v_alloc_net + v_alloc_tax,2) - v_payment) > 0.01 THEN
        RAISE EXCEPTION 'STATE: decomposição fiscal da alocação é inconsistente';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.financeiro_pagamento_alocacoes (
    escola_id,
    pagamento_id,
    mensalidade_id,
    fiscal_documento_origem_id,
    natureza,
    valor_bruto_aoa,
    valor_liquido_aoa,
    valor_imposto_aoa,
    idempotency_key,
    metadata,
    created_by
  )
  VALUES (
    v_pagamento.escola_id,
    v_pagamento.id,
    v_mensalidade.id,
    CASE WHEN v_source.id IS NULL THEN NULL ELSE v_source.id END,
    'aplicacao',
    v_payment,
    CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_net END,
    CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_tax END,
    format('pagamento:%s:mensalidade:%s:aplicacao:v1',v_pagamento.id,v_mensalidade.id),
    jsonb_build_object(
      'allocation_method',
      CASE WHEN v_source.id IS NULL THEN 'financial_only_v1' ELSE 'proportional_residual_v1' END,
      'source_document_type', CASE WHEN v_source.id IS NULL THEN NULL ELSE v_source.tipo_documento END,
      'source_document_no', CASE WHEN v_source.id IS NULL THEN NULL ELSE v_source.numero_formatado END,
      'source_total_mismatch_with_mensalidade', v_source_mismatch,
      'mensalidade_expected_before', v_expected,
      'mensalidade_paid_before', v_current
    ),
    v_actor
  )
  RETURNING id INTO v_alloc_id;

  v_new_paid := round(v_current + v_payment,2);
  v_new_status := CASE
    WHEN v_new_paid >= v_expected - 0.01 THEN 'pago'
    ELSE 'pago_parcial'
  END;

  v_method_legacy := CASE v_pagamento.metodo::text
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
    ELSE COALESCE(v_pagamento.metodo_pagamento,'desconhecido')
  END;

  UPDATE public.mensalidades
  SET
    status = v_new_status,
    valor_pago_total = v_new_paid,
    data_pagamento_efetiva = CASE
      WHEN v_new_status = 'pago'
        THEN COALESCE(data_pagamento_efetiva, v_pagamento.settled_at::date, v_pagamento.data_pagamento, CURRENT_DATE)
      ELSE data_pagamento_efetiva
    END,
    metodo_pagamento = v_method_legacy,
    updated_at = now(),
    updated_by = v_actor
  WHERE id = v_mensalidade.id;

  SELECT id
    INTO v_lancamento_id
  FROM public.financeiro_lancamentos
  WHERE escola_id = v_mensalidade.escola_id
    AND aluno_id = v_mensalidade.aluno_id
    AND origem = 'mensalidade'
    AND tipo = 'debito'
    AND ano_referencia IS NOT DISTINCT FROM v_mensalidade.ano_referencia
    AND mes_referencia IS NOT DISTINCT FROM v_mensalidade.mes_referencia
    AND status IS DISTINCT FROM 'pago'
  ORDER BY (matricula_id IS DISTINCT FROM v_mensalidade.matricula_id), created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.financeiro_lancamentos
    SET
      status = CASE
        WHEN v_new_status = 'pago' THEN 'pago'::public.financeiro_status
        ELSE 'parcial'::public.financeiro_status
      END,
      data_pagamento = COALESCE(v_pagamento.settled_at, now()),
      metodo_pagamento = CASE v_pagamento.metodo::text
        WHEN 'cash' THEN 'numerario'::public.metodo_pagamento_enum
        WHEN 'tpa' THEN 'multicaixa'::public.metodo_pagamento_enum
        WHEN 'mcx' THEN 'multicaixa'::public.metodo_pagamento_enum
        WHEN 'kwik' THEN 'multicaixa'::public.metodo_pagamento_enum
        WHEN 'transfer' THEN 'transferencia'::public.metodo_pagamento_enum
        ELSE metodo_pagamento
      END,
      updated_at = now()
    WHERE id = v_lancamento_id;
  END IF;

  INSERT INTO public.audit_logs (
    escola_id, actor_id, action, entity, entity_id, portal, details, before, after
  )
  VALUES (
    v_pagamento.escola_id,
    v_actor,
    'PAGAMENTO_ALOCADO',
    'pagamentos',
    v_pagamento.id::text,
    'financeiro',
    jsonb_build_object(
      'alocacao_id',v_alloc_id,
      'mensalidade_id',v_mensalidade.id,
      'fiscal_documento_origem_id',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_source.id END,
      'valor_bruto_aoa',v_payment,
      'valor_liquido_aoa',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_net END,
      'valor_imposto_aoa',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_tax END,
      'requires_rc',v_source.id IS NOT NULL
    ),
    jsonb_build_object(
      'mensalidade_status',v_mensalidade.status,
      'valor_pago_total',v_current
    ),
    jsonb_build_object(
      'mensalidade_status',v_new_status,
      'valor_pago_total',v_new_paid
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'pagamento_id',v_pagamento.id,
    'mensalidade_id',v_mensalidade.id,
    'alocacao_id',v_alloc_id,
    'fiscal_documento_origem_id',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_source.id END,
    'requires_rc',v_source.id IS NOT NULL,
    'valor_bruto_aoa',v_payment,
    'valor_liquido_aoa',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_net END,
    'valor_imposto_aoa',CASE WHEN v_source.id IS NULL THEN NULL ELSE v_alloc_tax END,
    'mensalidade_status',v_new_status,
    'valor_pago_total',v_new_paid,
    'source_total_mismatch_with_mensalidade',v_source_mismatch
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.financeiro_guard_pagamento_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user <> 'postgres' THEN
    IF
      (to_jsonb(NEW) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status_fiscal','fiscal_documento_id','fiscal_error','updated_at']::text[])
    THEN
      RAISE EXCEPTION 'IMMUTABILITY: alterações financeiras do pagamento exigem RPC canónica';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamento_secretaria(p_escola_id uuid, p_aluno_id uuid, p_mensalidade_id uuid, p_valor numeric, p_metodo pagamento_metodo, p_reference text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_gateway_ref text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_row public.pagamentos%ROWTYPE;
  v_status public.pagamento_status;
  v_legacy_metodo text;
  v_ordem jsonb;
  v_idem text := NULLIF(btrim(COALESCE(p_meta->>'idempotency_key','')), '');
  v_m public.mensalidades%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT public.user_has_role_in_school(
       p_escola_id,
       ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin_escola','admin','staff_admin']
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  IF COALESCE(p_valor,0) <= 0 THEN
    RAISE EXCEPTION 'DATA: valor inválido';
  END IF;

  IF v_idem IS NOT NULL THEN
    SELECT *
      INTO v_row
    FROM public.pagamentos
    WHERE escola_id = p_escola_id
      AND idempotency_key = v_idem
    LIMIT 1;

    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  IF p_metodo = 'tpa' AND COALESCE(btrim(p_reference),'') = '' THEN
    RAISE EXCEPTION 'DATA: reference_required_for_tpa';
  END IF;

  IF p_metodo = 'transfer' AND COALESCE(btrim(p_evidence_url),'') = '' THEN
    RAISE EXCEPTION 'DATA: evidence_required_for_transfer';
  END IF;

  IF p_mensalidade_id IS NOT NULL THEN
    SELECT *
      INTO v_m
    FROM public.mensalidades
    WHERE id = p_mensalidade_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: mensalidade não encontrada';
    END IF;

    IF v_m.escola_id IS DISTINCT FROM p_escola_id
       OR v_m.aluno_id IS DISTINCT FROM p_aluno_id THEN
      RAISE EXCEPTION 'AUTH: mensalidade fora do contexto informado';
    END IF;

    v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
      p_escola_id,p_aluno_id,p_mensalidade_id
    );

    IF COALESCE((v_ordem->>'ok')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION '%',COALESCE(v_ordem->>'message','Existe uma mensalidade anterior em aberto.');
    END IF;
  END IF;

  v_status := CASE WHEN p_metodo = 'cash' THEN 'settled' ELSE 'pending' END;
  v_legacy_metodo := CASE p_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
  END;

  INSERT INTO public.pagamentos (
    escola_id,aluno_id,mensalidade_id,valor_pago,data_pagamento,
    metodo,metodo_pagamento,status,reference,evidence_url,gateway_ref,
    created_by,settled_at,settled_by,meta,idempotency_key
  )
  VALUES (
    p_escola_id,p_aluno_id,p_mensalidade_id,round(p_valor,2),CURRENT_DATE,
    p_metodo,v_legacy_metodo,v_status,p_reference,p_evidence_url,p_gateway_ref,
    v_actor,
    CASE WHEN v_status='settled' THEN now() ELSE NULL END,
    CASE WHEN v_status='settled' THEN v_actor ELSE NULL END,
    COALESCE(p_meta,'{}'::jsonb),
    v_idem
  )
  ON CONFLICT (escola_id,idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND AND v_idem IS NOT NULL THEN
    SELECT *
      INTO v_row
    FROM public.pagamentos
    WHERE escola_id=p_escola_id AND idempotency_key=v_idem
    LIMIT 1;
    RETURN v_row;
  END IF;

  IF v_status='settled' AND p_mensalidade_id IS NOT NULL THEN
    PERFORM public.financeiro_aplicar_pagamento_existente(v_row.id,v_actor);
  END IF;

  RETURN v_row;
END;
$function$


CREATE OR REPLACE FUNCTION public.financeiro_settle_pagamento(p_escola_id uuid, p_pagamento_id uuid, p_settle_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_row public.pagamentos%ROWTYPE;
  v_ordem jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT public.user_has_role_in_school(
       p_escola_id,
       ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin_escola','admin','staff_admin']
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  SELECT *
    INTO v_row
  FROM public.pagamentos
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_row.status='settled' THEN
    IF v_row.mensalidade_id IS NOT NULL THEN
      PERFORM public.financeiro_aplicar_pagamento_existente(v_row.id,v_actor);
    END IF;
    RETURN v_row;
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'STATE: pagamento não está pendente';
  END IF;

  IF v_row.mensalidade_id IS NOT NULL THEN
    v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
      v_row.escola_id,v_row.aluno_id,v_row.mensalidade_id
    );
    IF COALESCE((v_ordem->>'ok')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION '%',COALESCE(v_ordem->>'message','Existe uma mensalidade anterior em aberto.');
    END IF;
  END IF;

  UPDATE public.pagamentos
  SET status='settled',
      settled_at=now(),
      settled_by=v_actor,
      updated_at=now(),
      meta=COALESCE(meta,'{}'::jsonb) ||
        jsonb_build_object('settle_meta',COALESCE(p_settle_meta,'{}'::jsonb))
  WHERE id=v_row.id
  RETURNING * INTO v_row;

  IF v_row.mensalidade_id IS NOT NULL THEN
    PERFORM public.financeiro_aplicar_pagamento_existente(v_row.id,v_actor);
  END IF;

  RETURN v_row;
END;
$function$


CREATE OR REPLACE FUNCTION public.registrar_pagamento(p_mensalidade_id uuid, p_metodo_pagamento text, p_observacao text DEFAULT NULL::text, p_valor_pago numeric DEFAULT NULL::numeric, p_promessa_liquidacao date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_m public.mensalidades%ROWTYPE;
  v_payment public.pagamentos%ROWTYPE;
  v_valor numeric(18,2);
  v_outstanding numeric(18,2);
  v_metodo public.pagamento_metodo;
  v_legacy text;
  v_apply jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  SELECT *
    INTO v_m
  FROM public.mensalidades
  WHERE id=p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'erro','Mensalidade não encontrada.');
  END IF;

  IF NOT public.is_super_admin()
     AND NOT public.user_has_role_in_school(
       v_m.escola_id,
       ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro','admin_escola','admin','staff_admin']
     ) THEN
    RAISE EXCEPTION 'AUTH: forbidden';
  END IF;

  v_outstanding := GREATEST(
    round(COALESCE(v_m.valor_previsto,v_m.valor,0)::numeric - COALESCE(v_m.valor_pago_total,0)::numeric,2),
    0
  );

  v_valor := round(COALESCE(p_valor_pago,v_outstanding)::numeric,2);

  IF v_valor <= 0 THEN
    RETURN jsonb_build_object('ok',false,'erro','Valor de pagamento deve ser maior que zero.');
  END IF;

  IF v_valor > v_outstanding + 0.01 THEN
    RETURN jsonb_build_object('ok',false,'erro','Valor pago excede o saldo da mensalidade.');
  END IF;

  v_metodo := CASE lower(COALESCE(p_metodo_pagamento,''))
    WHEN 'dinheiro' THEN 'cash'::public.pagamento_metodo
    WHEN 'numerario' THEN 'cash'::public.pagamento_metodo
    WHEN 'cash' THEN 'cash'::public.pagamento_metodo
    WHEN 'tpa' THEN 'tpa'::public.pagamento_metodo
    WHEN 'tpa_fisico' THEN 'tpa'::public.pagamento_metodo
    WHEN 'multicaixa' THEN 'mcx'::public.pagamento_metodo
    WHEN 'mcx' THEN 'mcx'::public.pagamento_metodo
    WHEN 'kwik' THEN 'kwik'::public.pagamento_metodo
    ELSE NULL
  END;

  IF v_metodo IS NULL THEN
    RETURN jsonb_build_object(
      'ok',false,
      'erro','Método legado não pode ser liquidado sem evidência; use o fluxo canónico.'
    );
  END IF;

  v_legacy := CASE v_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
    ELSE 'desconhecido'
  END;

  INSERT INTO public.pagamentos (
    escola_id,aluno_id,mensalidade_id,valor_pago,data_pagamento,
    metodo,metodo_pagamento,status,created_by,settled_at,settled_by,meta
  )
  VALUES (
    v_m.escola_id,v_m.aluno_id,v_m.id,v_valor,CURRENT_DATE,
    v_metodo,v_legacy,'settled',v_actor,now(),v_actor,
    jsonb_build_object(
      'origem','registrar_pagamento_compat',
      'observacao',p_observacao,
      'promessa_liquidacao',p_promessa_liquidacao
    )
  )
  RETURNING * INTO v_payment;

  v_apply := public.financeiro_aplicar_pagamento_existente(v_payment.id,v_actor);

  RETURN jsonb_build_object(
    'ok',true,
    'pagamento_id',v_payment.id,
    'id',v_m.id,
    'valor_registrado',v_valor,
    'novo_total_pago',v_apply->'valor_pago_total',
    'status',v_apply->>'mensalidade_status',
    'allocation',v_apply,
    'mensagem','Pagamento registado com sucesso.'
  );
END;
$function$


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
      'valor_pago',v_pagamento.valor_pago
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
$function$


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


DROP TRIGGER IF EXISTS trg_pagamentos_financial_update_guard ON public.pagamentos;
CREATE TRIGGER trg_pagamentos_financial_update_guard
BEFORE UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_guard_pagamento_update();

REVOKE EXECUTE ON FUNCTION public.financeiro_aplicar_pagamento_existente(uuid,uuid)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.financeiro_registrar_pagamento_secretaria(
  uuid,uuid,uuid,numeric,public.pagamento_metodo,text,text,text,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_registrar_pagamento_secretaria(
  uuid,uuid,uuid,numeric,public.pagamento_metodo,text,text,text,jsonb
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.financeiro_settle_pagamento(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_settle_pagamento(uuid,uuid,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.validar_pagamento(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_pagamento(uuid,boolean,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_pagamento(uuid,text,text,numeric,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento(uuid,text,text,numeric,date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reverter_pagamento_realizado(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverter_pagamento_realizado(uuid,text,text) TO authenticated, service_role;

COMMIT;