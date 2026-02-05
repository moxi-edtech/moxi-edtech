CREATE OR REPLACE FUNCTION "public"."emitir_recibo"("p_mensalidade_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_m public.mensalidades%ROWTYPE;
  v_doc record;
  v_hash_validacao text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT *
    INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  -- User deve pertencer à escola da mensalidade
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  -- Apenas mensalidades pagas
  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não está paga');
  END IF;

  -- Idempotência: retorna recibo existente
  SELECT id, public_id, created_at
    INTO v_doc
  FROM public.documentos_emitidos
  WHERE tipo = 'recibo'
    AND mensalidade_id = p_mensalidade_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'doc_id', v_doc.id,
      'public_id', v_doc.public_id,
      'emitido_em', v_doc.created_at
    );
  END IF;

  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  -- Cria snapshot do recibo
  INSERT INTO public.documentos_emitidos (
    escola_id, aluno_id, mensalidade_id, tipo, dados_snapshot, created_by, hash_validacao
  ) VALUES (
    v_m.escola_id,
    v_m.aluno_id,
    v_m.id,
    'recibo',
    jsonb_build_object(
      'mensalidade_id', v_m.id,
      'referencia', to_char(make_date(v_m.ano_referencia, v_m.mes_referencia, 1), 'TMMon/YYYY'),
      'valor_pago', v_m.valor_pago_total,
      'data_pagamento', v_m.data_pagamento_efetiva,
      'metodo', v_m.metodo_pagamento,
      'hash_validacao', v_hash_validacao
    ),
    v_user_id,
    v_hash_validacao
  )
  RETURNING id, public_id, created_at
  INTO v_doc;

  RETURN jsonb_build_object(
    'ok', true,
    'doc_id', v_doc.id,
    'public_id', v_doc.public_id,
    'emitido_em', v_doc.created_at
  );
END;
$$;
