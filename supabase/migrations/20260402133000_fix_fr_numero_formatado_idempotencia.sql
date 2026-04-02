BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_emitir_documento(
  p_empresa_id uuid,
  p_serie_id uuid,
  p_tipo_documento text,
  p_prefixo_serie text,
  p_origem_documento text,
  p_cliente jsonb,
  p_invoice_date date,
  p_moeda text,
  p_itens jsonb,
  p_documento_origem_id uuid DEFAULT NULL,
  p_rectifica_documento_id uuid DEFAULT NULL,
  p_taxa_cambio_aoa numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_assinatura_base64 text DEFAULT NULL,
  p_payment_mechanism text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_serie public.fiscal_series%ROWTYPE;
  v_key public.fiscal_chaves%ROWTYPE;
  v_numero bigint;
  v_numero_formatado text;
  v_total_liquido numeric(18,4) := 0;
  v_total_impostos numeric(18,4) := 0;
  v_total_bruto numeric(18,4) := 0;
  v_documento_id uuid;
  v_hash_anterior text;
  v_canonical text;
  v_hash_control text;
  v_assinatura text;
  v_status text;
  v_cliente_nome text;
  v_cliente_nif text;
  v_cliente_id uuid;
  v_moeda text;
  v_cambio numeric(18,8);
  v_item jsonb;
  v_index integer;
  v_quantidade numeric(18,4);
  v_preco numeric(18,4);
  v_taxa numeric(5,2);
  v_base numeric(18,4);
  v_imposto numeric(18,4);
  v_bruto numeric(18,4);
  v_tax_exemption_code text;
  v_tax_exemption_reason text;
  v_product_code text;
  v_product_number_code text;
  v_payment_mechanism text;
  v_origem_operacao text;
  v_origem_id text;
  v_existing_documento public.fiscal_documentos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  IF NOT public.user_has_role_in_empresa(p_empresa_id, ARRAY['owner','admin','operator']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para emitir documento fiscal';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série fiscal não encontrada';
  END IF;

  IF v_serie.empresa_id IS DISTINCT FROM p_empresa_id THEN
    RAISE EXCEPTION 'DATA: série não pertence à empresa fiscal';
  END IF;

  IF v_serie.tipo_documento IS DISTINCT FROM p_tipo_documento THEN
    RAISE EXCEPTION 'DATA: tipo_documento divergente da série';
  END IF;

  IF v_serie.prefixo IS DISTINCT FROM p_prefixo_serie THEN
    RAISE EXCEPTION 'DATA: prefixo divergente da série';
  END IF;

  IF v_serie.origem_documento IS DISTINCT FROM p_origem_documento THEN
    RAISE EXCEPTION 'DATA: origem_documento divergente da série';
  END IF;

  IF NOT v_serie.ativa OR v_serie.descontinuada_em IS NOT NULL THEN
    RAISE EXCEPTION 'STATE: série inativa ou descontinuada';
  END IF;

  v_moeda := upper(trim(p_moeda));
  IF v_moeda IS NULL OR length(v_moeda) <> 3 THEN
    RAISE EXCEPTION 'DATA: moeda inválida';
  END IF;

  IF v_moeda <> 'AOA' AND p_taxa_cambio_aoa IS NULL THEN
    RAISE EXCEPTION 'DATA: taxa_cambio_aoa obrigatória para moeda != AOA';
  END IF;

  IF v_moeda = 'AOA' AND p_taxa_cambio_aoa IS NOT NULL THEN
    RAISE EXCEPTION 'DATA: taxa_cambio_aoa não permitida para AOA';
  END IF;

  v_cambio := CASE WHEN v_moeda = 'AOA' THEN 1 ELSE p_taxa_cambio_aoa END;

  v_payment_mechanism := upper(nullif(trim(coalesce(p_payment_mechanism, '')), ''));

  IF p_tipo_documento = 'RC' AND v_payment_mechanism IS NULL THEN
    RAISE EXCEPTION 'DATA: payment_mechanism obrigatório para recibos (RC)';
  END IF;

  IF v_payment_mechanism IS NOT NULL AND v_payment_mechanism NOT IN ('NU', 'TB', 'CC', 'MB') THEN
    RAISE EXCEPTION 'DATA: payment_mechanism inválido';
  END IF;

  IF p_tipo_documento <> 'RC' THEN
    v_payment_mechanism := NULL;
  END IF;

  v_cliente_nome := nullif(trim(coalesce(p_cliente->>'nome', '')), '');
  v_cliente_nif := nullif(trim(coalesce(p_cliente->>'nif', '')), '');

  IF v_cliente_nif IS NULL THEN
    v_cliente_nif := '999999999';
    v_cliente_nome := 'Consumidor final';
  END IF;

  IF v_cliente_nome IS NULL THEN
    RAISE EXCEPTION 'DATA: cliente.nome obrigatório';
  END IF;

  IF v_cliente_nif !~ '^[0-9]{9,20}$' THEN
    RAISE EXCEPTION 'DATA: cliente.nif inválido';
  END IF;

  v_cliente_id := NULL;
  IF p_cliente ? 'id' THEN
    v_cliente_id := NULLIF(trim(p_cliente->>'id'), '')::uuid;
  END IF;

  IF p_tipo_documento = 'NC' AND p_rectifica_documento_id IS NULL THEN
    RAISE EXCEPTION 'DATA: rectifica_documento_id obrigatório para nota de crédito';
  END IF;

  IF p_rectifica_documento_id IS NOT NULL THEN
    PERFORM 1
    FROM public.fiscal_documentos
    WHERE id = p_rectifica_documento_id
      AND empresa_id = p_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento rectificado não encontrado';
    END IF;
  END IF;

  IF p_documento_origem_id IS NOT NULL THEN
    PERFORM 1
    FROM public.fiscal_documentos
    WHERE id = p_documento_origem_id
      AND empresa_id = p_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: documento origem não encontrado';
    END IF;
  END IF;

  IF p_itens IS NULL
    OR jsonb_typeof(p_itens) <> 'array'
    OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'DATA: itens obrigatórios';
  END IF;

  SELECT *
    INTO v_key
  FROM public.fiscal_chaves
  WHERE empresa_id = p_empresa_id
    AND status = 'active'
  ORDER BY key_version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATE: chave fiscal activa não encontrada';
  END IF;

  v_origem_operacao := nullif(trim(coalesce(p_metadata->>'origem_operacao', '')), '');
  v_origem_id := nullif(trim(coalesce(p_metadata->>'origem_id', '')), '');

  IF p_origem_documento = 'integrado'
    AND v_origem_operacao IS NOT NULL
    AND v_origem_id IS NOT NULL THEN
    SELECT *
      INTO v_existing_documento
    FROM public.fiscal_documentos
    WHERE empresa_id = p_empresa_id
      AND tipo_documento = p_tipo_documento
      AND coalesce(payload->'metadata'->>'origem_operacao', '') = v_origem_operacao
      AND coalesce(payload->'metadata'->>'origem_id', '') = v_origem_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'documento_id', v_existing_documento.id,
        'numero', v_existing_documento.numero,
        'numero_formatado', v_existing_documento.numero_formatado,
        'hash_control', v_existing_documento.hash_control,
        'key_version', v_existing_documento.key_version,
        'status', v_existing_documento.status,
        'canonical_string', v_existing_documento.canonical_string
      );
    END IF;
  END IF;

  SELECT numero, numero_formatado
    INTO v_numero, v_numero_formatado
  FROM public.fiscal_reservar_numero_serie(p_serie_id);

  v_numero_formatado := format(
    '%s %s/%s',
    upper(trim(p_tipo_documento)),
    trim(v_serie.prefixo),
    v_numero::text
  );

  SELECT hash_control
    INTO v_hash_anterior
  FROM public.fiscal_documentos
  WHERE serie_id = p_serie_id
  ORDER BY numero DESC
  LIMIT 1;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_quantidade := (v_item->>'quantidade')::numeric(18,4);
    v_preco := (v_item->>'preco_unit')::numeric(18,4);
    v_taxa := (v_item->>'taxa_iva')::numeric(5,2);
    v_tax_exemption_code := nullif(trim(coalesce(v_item->>'tax_exemption_code', '')), '');
    v_tax_exemption_reason := nullif(trim(coalesce(v_item->>'tax_exemption_reason', '')), '');
    v_product_code := nullif(trim(coalesce(v_item->>'product_code', '')), '');
    v_product_number_code := nullif(trim(coalesce(v_item->>'product_number_code', '')), '');

    IF v_product_code IS NULL THEN
      RAISE EXCEPTION 'DATA: product_code obrigatório em todos os itens';
    END IF;

    IF v_product_number_code IS NULL THEN
      v_product_number_code := v_product_code;
    END IF;

    IF v_taxa = 0 AND (v_tax_exemption_code IS NULL OR v_tax_exemption_reason IS NULL) THEN
      RAISE EXCEPTION 'DATA: tax_exemption_code e tax_exemption_reason obrigatórios quando taxa_iva = 0';
    END IF;

    v_base := v_quantidade * v_preco;
    v_imposto := v_base * v_taxa / 100;
    v_bruto := v_base + v_imposto;
    v_base := round(v_base * v_cambio, 4);
    v_imposto := round(v_imposto * v_cambio, 4);
    v_bruto := round(v_bruto * v_cambio, 4);
    v_total_liquido := v_total_liquido + v_base;
    v_total_impostos := v_total_impostos + v_imposto;
    v_total_bruto := v_total_bruto + v_bruto;
  END LOOP;

  v_canonical := jsonb_build_object(
    'empresa_id', p_empresa_id,
    'serie_id', p_serie_id,
    'numero', v_numero,
    'numero_formatado', v_numero_formatado,
    'tipo_documento', p_tipo_documento,
    'invoice_date', p_invoice_date,
    'moeda', v_moeda,
    'taxa_cambio_aoa', v_cambio,
    'payment_mechanism', v_payment_mechanism,
    'total_bruto_aoa', v_total_bruto,
    'total_impostos_aoa', v_total_impostos,
    'total_liquido_aoa', v_total_liquido,
    'hash_anterior', v_hash_anterior,
    'cliente_nome', v_cliente_nome,
    'cliente_nif', v_cliente_nif
  )::text;

  v_hash_control := encode(sha256(v_canonical::bytea), 'hex');
  v_assinatura := nullif(p_assinatura_base64, '');
  v_status := CASE WHEN v_assinatura IS NULL THEN 'pendente_assinatura' ELSE 'emitido' END;
  IF v_assinatura IS NULL THEN
    v_assinatura := encode(sha256((v_hash_control || coalesce(v_hash_anterior, ''))::bytea), 'base64');
  END IF;

  INSERT INTO public.fiscal_documentos (
    empresa_id,
    serie_id,
    tipo_documento,
    numero,
    numero_formatado,
    cliente_id,
    cliente_nome,
    cliente_nif,
    invoice_date,
    moeda,
    taxa_cambio_aoa,
    payment_mechanism,
    total_bruto_aoa,
    total_impostos_aoa,
    total_liquido_aoa,
    hash_anterior,
    assinatura_base64,
    hash_control,
    canonical_string,
    key_version,
    status,
    documento_origem_id,
    rectifica_documento_id,
    payload,
    created_by
  )
  VALUES (
    p_empresa_id,
    p_serie_id,
    p_tipo_documento,
    v_numero,
    v_numero_formatado,
    v_cliente_id,
    v_cliente_nome,
    v_cliente_nif,
    p_invoice_date,
    v_moeda,
    p_taxa_cambio_aoa,
    v_payment_mechanism,
    v_total_bruto,
    v_total_impostos,
    v_total_liquido,
    v_hash_anterior,
    v_assinatura,
    v_hash_control,
    v_canonical,
    v_key.key_version,
    v_status,
    p_documento_origem_id,
    p_rectifica_documento_id,
    jsonb_build_object(
      'cliente', p_cliente,
      'itens', p_itens,
      'metadata', coalesce(p_metadata, '{}'::jsonb),
      'payment_mechanism', v_payment_mechanism
    ),
    v_uid
  )
  RETURNING id INTO v_documento_id;

  FOR v_item, v_index IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY
  LOOP
    v_quantidade := (v_item->>'quantidade')::numeric(18,4);
    v_preco := (v_item->>'preco_unit')::numeric(18,4);
    v_taxa := (v_item->>'taxa_iva')::numeric(5,2);
    v_tax_exemption_code := nullif(trim(coalesce(v_item->>'tax_exemption_code', '')), '');
    v_tax_exemption_reason := nullif(trim(coalesce(v_item->>'tax_exemption_reason', '')), '');
    v_product_code := nullif(trim(coalesce(v_item->>'product_code', '')), '');
    v_product_number_code := nullif(trim(coalesce(v_item->>'product_number_code', '')), '');

    IF v_product_code IS NULL THEN
      RAISE EXCEPTION 'DATA: product_code obrigatório em todos os itens';
    END IF;

    IF v_product_number_code IS NULL THEN
      v_product_number_code := v_product_code;
    END IF;

    IF v_taxa > 0 THEN
      v_tax_exemption_code := NULL;
      v_tax_exemption_reason := NULL;
    END IF;

    v_base := v_quantidade * v_preco;
    v_imposto := v_base * v_taxa / 100;
    v_bruto := v_base + v_imposto;
    v_base := round(v_base * v_cambio, 4);
    v_imposto := round(v_imposto * v_cambio, 4);
    v_bruto := round(v_bruto * v_cambio, 4);

    INSERT INTO public.fiscal_documento_itens (
      empresa_id,
      documento_id,
      linha_no,
      descricao,
      product_code,
      product_number_code,
      quantidade,
      preco_unit,
      taxa_iva,
      tax_exemption_code,
      tax_exemption_reason,
      total_liquido_aoa,
      total_impostos_aoa,
      total_bruto_aoa
    )
    VALUES (
      p_empresa_id,
      v_documento_id,
      v_index,
      (v_item->>'descricao'),
      v_product_code,
      v_product_number_code,
      v_quantidade,
      v_preco,
      v_taxa,
      v_tax_exemption_code,
      v_tax_exemption_reason,
      v_base,
      v_imposto,
      v_bruto
    );
  END LOOP;

  IF v_status = 'emitido' THEN
    INSERT INTO public.fiscal_documentos_eventos (
      empresa_id,
      documento_id,
      tipo_evento,
      payload,
      created_by
    )
    VALUES (
      p_empresa_id,
      v_documento_id,
      'EMITIDO',
      jsonb_build_object(
        'hash_control', v_hash_control,
        'hash_anterior', v_hash_anterior,
        'numero_formatado', v_numero_formatado,
        'payment_mechanism', v_payment_mechanism
      ),
      v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'documento_id', v_documento_id,
    'numero', v_numero,
    'numero_formatado', v_numero_formatado,
    'hash_control', v_hash_control,
    'key_version', v_key.key_version,
    'status', v_status,
    'canonical_string', v_canonical
  );
END;
$$;

ALTER FUNCTION public.fiscal_emitir_documento(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  uuid,
  uuid,
  numeric,
  jsonb,
  text,
  text
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.fiscal_emitir_documento(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  date,
  text,
  jsonb,
  uuid,
  uuid,
  numeric,
  jsonb,
  text,
  text
) TO authenticated;

COMMIT;
