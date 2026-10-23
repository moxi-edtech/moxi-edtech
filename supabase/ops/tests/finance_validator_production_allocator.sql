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

