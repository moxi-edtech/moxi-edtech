BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_alocar_pagamento_multiplas_mensalidades(p_pagamento_id uuid, p_alocacoes jsonb, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_claim_role text := COALESCE(current_setting('request.jwt.claim.role',true),'');
  v_pagamento public.pagamentos%ROWTYPE;
  v_item record;
  v_source public.fiscal_documentos%ROWTYPE;
  v_actor uuid;
  v_expected numeric(18,2);
  v_current numeric(18,2);
  v_outstanding numeric(18,2);
  v_amount numeric(18,2);
  v_total_requested numeric(18,2);
  v_total_existing numeric(18,2);
  v_remaining_gross numeric(18,2);
  v_remaining_net numeric(18,2);
  v_remaining_tax numeric(18,2);
  v_active_gross numeric(18,2);
  v_active_net numeric(18,2);
  v_active_tax numeric(18,2);
  v_alloc_net numeric(18,2);
  v_alloc_tax numeric(18,2);
  v_ratio numeric(18,8);
  v_new_paid numeric(18,2);
  v_new_status text;
  v_alloc_id uuid;
  v_count_input integer;
  v_count_locked integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: alocação múltipla é exclusiva do backend financeiro';
  END IF;

  IF jsonb_typeof(p_alocacoes) <> 'array'
     OR jsonb_array_length(p_alocacoes) = 0
     OR jsonb_array_length(p_alocacoes) > 50 THEN
    RAISE EXCEPTION 'DATA: alocações devem conter entre 1 e 50 itens';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE id=p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: pagamento não encontrado';
  END IF;

  IF v_pagamento.status NOT IN ('settled','concluido','pago') THEN
    RAISE EXCEPTION 'STATE: pagamento precisa estar liquidado';
  END IF;

  IF v_pagamento.mensalidade_id IS NOT NULL THEN
    RAISE EXCEPTION 'STATE: pagamento já está vinculado a uma mensalidade; use aplicação canónica simples';
  END IF;

  SELECT
    count(*),
    round(COALESCE(sum((x.valor)::numeric),0),2)
  INTO v_count_input,v_total_requested
  FROM jsonb_to_recordset(p_alocacoes)
    AS x(mensalidade_id uuid,valor numeric);

  IF v_count_input <> (
    SELECT count(DISTINCT x.mensalidade_id)
    FROM jsonb_to_recordset(p_alocacoes)
      AS x(mensalidade_id uuid,valor numeric)
  ) THEN
    RAISE EXCEPTION 'DATA: mensalidade duplicada nas alocações';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_alocacoes)
      AS x(mensalidade_id uuid,valor numeric)
    WHERE x.mensalidade_id IS NULL OR COALESCE(x.valor,0) <= 0
  ) THEN
    RAISE EXCEPTION 'DATA: mensalidade/valor inválido nas alocações';
  END IF;

  IF abs(v_total_requested - round(v_pagamento.valor_pago::numeric,2)) > 0.01 THEN
    RAISE EXCEPTION
      'DATA: soma das alocações (%) diverge do pagamento (%)',
      v_total_requested,round(v_pagamento.valor_pago::numeric,2);
  END IF;

  SELECT round(COALESCE(sum(a.valor_bruto_aoa),0),2)
    INTO v_total_existing
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  IF v_total_existing > 0 THEN
    IF abs(v_total_existing-round(v_pagamento.valor_pago::numeric,2)) <= 0.01 THEN
      RETURN jsonb_build_object(
        'ok',true,
        'idempotent',true,
        'pagamento_id',v_pagamento.id,
        'valor_alocado',v_total_existing,
        'alocacoes',(
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'alocacao_id',a.id,
            'mensalidade_id',a.mensalidade_id,
            'fiscal_documento_origem_id',a.fiscal_documento_origem_id,
            'valor_bruto_aoa',a.valor_bruto_aoa,
            'valor_liquido_aoa',a.valor_liquido_aoa,
            'valor_imposto_aoa',a.valor_imposto_aoa
          ) ORDER BY a.created_at,a.id),'[]'::jsonb)
          FROM public.financeiro_pagamento_alocacoes a
          WHERE a.pagamento_id=v_pagamento.id
            AND a.natureza='aplicacao'
            AND NOT EXISTS (
              SELECT 1 FROM public.financeiro_pagamento_alocacoes r
              WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
            )
        )
      );
    END IF;

    RAISE EXCEPTION 'STATE: pagamento possui alocação parcial/inconsistente preexistente';
  END IF;

  v_actor := COALESCE(p_actor_id,v_pagamento.settled_by,v_pagamento.created_by);

  FOR v_item IN
    SELECT
      m.*,
      round(x.valor::numeric,2) AS allocation_value
    FROM jsonb_to_recordset(p_alocacoes)
      AS x(mensalidade_id uuid,valor numeric)
    JOIN public.mensalidades m ON m.id=x.mensalidade_id
    ORDER BY m.id
    FOR UPDATE OF m
  LOOP
    v_count_locked := v_count_locked+1;

    IF v_item.escola_id IS DISTINCT FROM v_pagamento.escola_id
       OR v_item.aluno_id IS DISTINCT FROM v_pagamento.aluno_id THEN
      RAISE EXCEPTION 'AUTH: mensalidade da alocação pertence a outro contexto';
    END IF;

    v_amount := v_item.allocation_value;
    v_expected := round(COALESCE(v_item.valor_previsto,v_item.valor,0)::numeric,2);
    v_current := round(COALESCE(v_item.valor_pago_total,0)::numeric,2);
    v_outstanding := GREATEST(round(v_expected-v_current,2),0);

    IF v_outstanding <= 0 THEN
      RAISE EXCEPTION 'STATE: mensalidade % já não possui saldo',v_item.id;
    END IF;

    IF v_amount > v_outstanding+0.01 THEN
      RAISE EXCEPTION
        'DATA: alocação (%) excede saldo (%) da mensalidade %',
        v_amount,v_outstanding,v_item.id;
    END IF;

    IF v_item.fiscal_documento_id IS NULL THEN
      RAISE EXCEPTION
        'STATE: alocação múltipla exige FT/ND fiscal de origem para mensalidade %',
        v_item.id;
    END IF;

    SELECT *
      INTO v_source
    FROM public.fiscal_documentos
    WHERE id=v_item.fiscal_documento_id
      AND tipo_documento IN ('FT','ND')
      AND status='emitido'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'STATE: documento fiscal origem inválido para mensalidade %',
        v_item.id;
    END IF;

    SELECT
      COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_bruto_aoa ELSE -valor_bruto_aoa END),2),0),
      COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_liquido_aoa ELSE -valor_liquido_aoa END),2),0),
      COALESCE(round(sum(CASE WHEN natureza='aplicacao' THEN valor_imposto_aoa ELSE -valor_imposto_aoa END),2),0)
    INTO v_active_gross,v_active_net,v_active_tax
    FROM public.financeiro_pagamento_alocacoes
    WHERE fiscal_documento_origem_id=v_source.id;

    v_remaining_gross := GREATEST(round(v_source.total_bruto_aoa::numeric-v_active_gross,2),0);
    v_remaining_net := GREATEST(round(v_source.total_liquido_aoa::numeric-v_active_net,2),0);
    v_remaining_tax := GREATEST(round(v_source.total_impostos_aoa::numeric-v_active_tax,2),0);

    IF v_amount > v_remaining_gross+0.01 THEN
      RAISE EXCEPTION
        'DATA: alocação (%) excede remanescente fiscal (%) de %',
        v_amount,v_remaining_gross,v_source.numero_formatado;
    END IF;

    IF abs(v_amount-v_remaining_gross) <= 0.01 THEN
      v_alloc_net := v_remaining_net;
      v_alloc_tax := v_remaining_tax;
    ELSE
      v_ratio := v_amount/NULLIF(v_remaining_gross,0);
      v_alloc_net := LEAST(v_remaining_net,round(v_remaining_net*v_ratio,2));
      v_alloc_tax := round(v_amount-v_alloc_net,2);
      IF v_alloc_tax > v_remaining_tax+0.01 THEN
        v_alloc_tax := v_remaining_tax;
        v_alloc_net := round(v_amount-v_alloc_tax,2);
      END IF;
    END IF;

    IF v_alloc_net < 0 OR v_alloc_tax < 0
       OR abs(round(v_alloc_net+v_alloc_tax,2)-v_amount) > 0.01 THEN
      RAISE EXCEPTION 'STATE: decomposição fiscal inválida para mensalidade %',v_item.id;
    END IF;

    INSERT INTO public.financeiro_pagamento_alocacoes (
      escola_id,pagamento_id,mensalidade_id,fiscal_documento_origem_id,
      natureza,valor_bruto_aoa,valor_liquido_aoa,valor_imposto_aoa,
      idempotency_key,metadata,created_by
    )
    VALUES (
      v_pagamento.escola_id,v_pagamento.id,v_item.id,v_source.id,
      'aplicacao',v_amount,v_alloc_net,v_alloc_tax,
      format('pagamento:%s:mensalidade:%s:aplicacao:v1',v_pagamento.id,v_item.id),
      jsonb_build_object(
        'allocation_method','multi_source_proportional_residual_v1',
        'source_document_type',v_source.tipo_documento,
        'source_document_no',v_source.numero_formatado
      ),
      v_actor
    )
    RETURNING id INTO v_alloc_id;

    v_new_paid := round(v_current+v_amount,2);
    v_new_status := CASE
      WHEN v_new_paid >= v_expected-0.01 THEN 'pago'
      ELSE 'pago_parcial'
    END;

    UPDATE public.mensalidades
    SET
      valor_pago_total=v_new_paid,
      status=v_new_status,
      data_pagamento_efetiva=CASE
        WHEN v_new_status='pago'
          THEN COALESCE(data_pagamento_efetiva,v_pagamento.settled_at::date,v_pagamento.data_pagamento,CURRENT_DATE)
        ELSE data_pagamento_efetiva
      END,
      metodo_pagamento=CASE v_pagamento.metodo::text
        WHEN 'cash' THEN 'dinheiro'
        WHEN 'tpa' THEN 'tpa'
        WHEN 'transfer' THEN 'transferencia'
        WHEN 'mcx' THEN 'multicaixa'
        WHEN 'kwik' THEN 'multicaixa'
        ELSE metodo_pagamento
      END,
      updated_at=now(),
      updated_by=v_actor
    WHERE id=v_item.id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'alocacao_id',v_alloc_id,
      'mensalidade_id',v_item.id,
      'fiscal_documento_origem_id',v_source.id,
      'valor_bruto_aoa',v_amount,
      'valor_liquido_aoa',v_alloc_net,
      'valor_imposto_aoa',v_alloc_tax,
      'mensalidade_status',v_new_status
    ));
  END LOOP;

  IF v_count_locked <> v_count_input THEN
    RAISE EXCEPTION 'DATA: uma ou mais mensalidades das alocações não foram encontradas';
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,actor_id,action,entity,entity_id,portal,details
  )
  VALUES (
    v_pagamento.escola_id,
    v_actor,
    'PAGAMENTO_MULTI_ALOCADO',
    'pagamentos',
    v_pagamento.id::text,
    'financeiro',
    jsonb_build_object(
      'valor_pago',v_pagamento.valor_pago,
      'quantidade_alocacoes',v_count_locked,
      'alocacoes',v_results
    )
  );

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'pagamento_id',v_pagamento.id,
    'valor_alocado',v_total_requested,
    'alocacoes',v_results,
    'requires_rc',true
  );
END;
$function$


REVOKE EXECUTE ON FUNCTION public.financeiro_alocar_pagamento_multiplas_mensalidades(uuid,jsonb,uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_alocar_pagamento_multiplas_mensalidades(uuid,jsonb,uuid)
TO service_role;

COMMIT;