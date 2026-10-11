-- Serialize secretaria payment writes per school/student to prevent lock-order deadlocks.
-- SECURITY DEFINER is retained intentionally: this gateway performs explicit authz
-- and calls an internal privileged settlement helper that remains inaccessible to authenticated.
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

  -- Serialize financial writes for the same school/student. This prevents
  -- concurrent checkouts from acquiring mensalidades/pagamentos locks in
  -- opposite order while preserving concurrency across different students.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'financeiro:student:' || p_escola_id::text || ':' || p_aluno_id::text,
      0
    )
  );

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
;

REVOKE ALL ON FUNCTION public.financeiro_registrar_pagamento_secretaria(
  uuid, uuid, uuid, numeric, public.pagamento_metodo, text, text, text, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.financeiro_registrar_pagamento_secretaria(
  uuid, uuid, uuid, numeric, public.pagamento_metodo, text, text, text, jsonb
) TO authenticated, service_role;
