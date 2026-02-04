CREATE OR REPLACE FUNCTION public.financeiro_registrar_pagamento_secretaria(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_mensalidade_id uuid,
  p_valor numeric,
  p_metodo public.pagamento_metodo,
  p_reference text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_status public.pagamento_status;
  v_legacy_metodo text;
  v_registro jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_metodo = 'cash' THEN
    v_status := 'settled';
  ELSE
    v_status := 'pending';
  END IF;

  IF p_metodo = 'tpa' AND (p_reference IS NULL OR length(trim(p_reference)) = 0) THEN
    RAISE EXCEPTION 'reference_required_for_tpa';
  END IF;

  IF p_metodo = 'transfer' AND (p_evidence_url IS NULL OR length(trim(p_evidence_url)) = 0) THEN
    RAISE EXCEPTION 'evidence_required_for_transfer';
  END IF;

  v_legacy_metodo := CASE p_metodo
    WHEN 'cash' THEN 'dinheiro'
    WHEN 'tpa' THEN 'tpa'
    WHEN 'transfer' THEN 'transferencia'
    WHEN 'mcx' THEN 'multicaixa'
    WHEN 'kwik' THEN 'multicaixa'
    ELSE 'dinheiro'
  END;

  INSERT INTO public.pagamentos (
    escola_id,
    aluno_id,
    mensalidade_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    reference,
    evidence_url,
    gateway_ref,
    created_by,
    settled_at,
    settled_by,
    meta
  ) VALUES (
    p_escola_id,
    p_aluno_id,
    p_mensalidade_id,
    p_valor,
    CURRENT_DATE,
    p_metodo,
    v_legacy_metodo,
    v_status,
    p_reference,
    p_evidence_url,
    p_gateway_ref,
    auth.uid(),
    CASE WHEN v_status = 'settled' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'settled' THEN auth.uid() ELSE NULL END,
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  IF v_status = 'settled' AND p_mensalidade_id IS NOT NULL THEN
    SELECT public.registrar_pagamento(
      p_mensalidade_id,
      v_legacy_metodo,
      COALESCE(p_meta->>'observacao', 'Pagamento via balcão')
    ) INTO v_registro;

    IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'mensalidade_update_failed';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_settle_pagamento(
  p_escola_id uuid,
  p_pagamento_id uuid,
  p_settle_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.pagamentos%ROWTYPE;
  v_mensalidade_status text;
  v_legacy_metodo text;
  v_registro jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.pagamentos
  SET status = 'settled',
      settled_at = now(),
      settled_by = auth.uid(),
      meta = meta || jsonb_build_object('settle_meta', COALESCE(p_settle_meta, '{}'::jsonb))
  WHERE id = p_pagamento_id
    AND escola_id = p_escola_id
    AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_not_pending';
  END IF;

  IF v_row.mensalidade_id IS NOT NULL THEN
    SELECT status INTO v_mensalidade_status
    FROM public.mensalidades
    WHERE id = v_row.mensalidade_id;

    IF v_mensalidade_status IS DISTINCT FROM 'pago' THEN
      v_legacy_metodo := CASE v_row.metodo
        WHEN 'cash' THEN 'dinheiro'
        WHEN 'tpa' THEN 'tpa'
        WHEN 'transfer' THEN 'transferencia'
        WHEN 'mcx' THEN 'multicaixa'
        WHEN 'kwik' THEN 'multicaixa'
        ELSE 'dinheiro'
      END;

      SELECT public.registrar_pagamento(
        v_row.mensalidade_id,
        v_legacy_metodo,
        COALESCE(p_settle_meta->>'observacao', 'Pagamento conciliado')
      ) INTO v_registro;

      IF COALESCE((v_registro->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'mensalidade_update_failed';
      END IF;
    END IF;
  END IF;

  RETURN v_row;
END;
$$;
