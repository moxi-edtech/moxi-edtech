-- DISPOSABLE ONLY. Proposed fiscal SQL, NOT a production migration.
DO $$ BEGIN IF current_database() <> 'bill023_fixture' THEN RAISE EXCEPTION 'DISPOSABLE_FIXTURE_ONLY'; END IF; END $$;
-- Full-schema integration proposal derived from live bodies. Run only after full disposable schema replay and core.
BEGIN;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='fiscal_emitir_documento') IS DISTINCT FROM '521aea72bbbc2c6d4c9513ec65fa76e8' THEN RAISE EXCEPTION 'SOURCE_DRIFT:fiscal_emitir_documento'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='fiscal_emitir_recibo_pagamento') IS DISTINCT FROM 'e78618b6a70dd79c4f3a553dfad28ec0' THEN RAISE EXCEPTION 'SOURCE_DRIFT:fiscal_emitir_recibo_pagamento'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='fiscal_require_agt_series_on_insert') IS DISTINCT FROM '2ada80846328d6d1b7b60a9665f4a420' THEN RAISE EXCEPTION 'SOURCE_DRIFT:fiscal_require_agt_series_on_insert'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.fiscal_emitir_documento(p_empresa_id uuid, p_serie_id uuid, p_tipo_documento text, p_prefixo_serie text, p_origem_documento text, p_cliente jsonb, p_invoice_date date, p_moeda text, p_itens jsonb, p_documento_origem_id uuid DEFAULT NULL::uuid, p_rectifica_documento_id uuid DEFAULT NULL::uuid, p_taxa_cambio_aoa numeric DEFAULT NULL::numeric, p_metadata jsonb DEFAULT '{}'::jsonb, p_assinatura_base64 text DEFAULT NULL::text, p_payment_mechanism text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
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
  v_tax_calc jsonb;
  v_itens_calculados jsonb;
  v_tax_profile_code text;
  v_tax_profile_version integer;
  v_tax_type text;
  v_tax_code text;
  v_tax_country_region text;
  v_operation_type text;
  v_unit_of_measure text;
  v_product_type text;
  v_unit_price_base numeric(18,4);
  v_settlement_amount numeric(18,4);
  v_total_liquido_moeda numeric(18,4);
  v_total_impostos_moeda numeric(18,4);
  v_total_bruto_moeda numeric(18,4);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  IF public.user_has_role_in_empresa(p_empresa_id, ARRAY['owner','admin','operator']) IS DISTINCT FROM true THEN
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

  PERFORM public.fiscal_assert_tax_profile_eligibility(
    p_empresa_id,
    profile.tax_profile_code
  )
  FROM (
    SELECT DISTINCT nullif(btrim(item->>'tax_profile_code'), '') AS tax_profile_code
    FROM jsonb_array_elements(p_itens) AS item
  ) AS profile
  WHERE profile.tax_profile_code IS NOT NULL;

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
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        p_empresa_id::text || '|' ||
        p_tipo_documento || '|' ||
        v_origem_operacao || '|' ||
        v_origem_id,
        0
      )
    );

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
  FROM fiscal_private.reserve_number(p_serie_id,p_empresa_id,p_tipo_documento,p_invoice_date);

  SELECT hash_control
    INTO v_hash_anterior
  FROM public.fiscal_documentos
  WHERE serie_id = p_serie_id
  ORDER BY numero DESC
  LIMIT 1;

  v_tax_calc := public.fiscal_tax_compute_document(
    p_itens,
    p_invoice_date,
    p_tipo_documento,
    v_moeda,
    CASE WHEN v_moeda='AOA' THEN 1 ELSE p_taxa_cambio_aoa END
  );
  v_itens_calculados := v_tax_calc->'itens';
  v_total_liquido := (v_tax_calc->>'total_liquido_aoa')::numeric;
  v_total_impostos := (v_tax_calc->>'total_impostos_aoa')::numeric;
  v_total_bruto := (v_tax_calc->>'total_bruto_aoa')::numeric;

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
  -- The canonical contract is pending-first. Do not fabricate or accept a supplied signature.
  IF nullif(btrim(p_assinatura_base64),'') IS NOT NULL THEN
    RAISE EXCEPTION 'DATA: assinatura deve ser finalizada separadamente';
  END IF;
  v_assinatura := NULL;
  v_status := 'pendente_assinatura';

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
      'itens', v_itens_calculados,
      'metadata', coalesce(p_metadata, '{}'::jsonb),
      'payment_mechanism', v_payment_mechanism
    ),
    v_uid
  )
  RETURNING id INTO v_documento_id;

  FOR v_item, v_index IN
    SELECT value, ordinality
    FROM jsonb_array_elements(v_itens_calculados) WITH ORDINALITY
  LOOP
    v_quantidade := (v_item->>'quantidade')::numeric(18,4);
    v_preco := (v_item->>'preco_unit')::numeric(18,4);
    v_taxa := (v_item->>'taxa_iva')::numeric(7,4);
    v_tax_exemption_code := nullif(trim(coalesce(v_item->>'tax_exemption_code', '')), '');
    v_tax_exemption_reason := nullif(trim(coalesce(v_item->>'tax_exemption_reason', '')), '');
    v_product_code := nullif(trim(coalesce(v_item->>'product_code', '')), '');
    v_product_number_code := nullif(trim(coalesce(v_item->>'product_number_code', '')), '');
    v_tax_profile_code := nullif(trim(coalesce(v_item->>'tax_profile_code','')), '');
    v_tax_profile_version := nullif(v_item->>'tax_profile_version','')::integer;
    v_tax_type := nullif(trim(coalesce(v_item->>'tax_type','')), '');
    v_tax_code := nullif(trim(coalesce(v_item->>'tax_code','')), '');
    v_tax_country_region := nullif(trim(coalesce(v_item->>'tax_country_region','')), '');
    v_operation_type := nullif(trim(coalesce(v_item->>'operation_type','')), '');
    v_unit_of_measure := nullif(trim(coalesce(v_item->>'unit_of_measure','')), '');
    v_product_type := nullif(trim(coalesce(v_item->>'product_type','')), '');
    v_unit_price_base := (v_item->>'unit_price_base')::numeric(18,4);
    v_settlement_amount := (v_item->>'settlement_amount')::numeric(18,4);
    v_total_liquido_moeda := (v_item->>'total_liquido_moeda')::numeric(18,4);
    v_total_impostos_moeda := (v_item->>'total_impostos_moeda')::numeric(18,4);
    v_total_bruto_moeda := (v_item->>'total_bruto_moeda')::numeric(18,4);
    v_base := (v_item->>'total_liquido_aoa')::numeric(18,4);
    v_imposto := (v_item->>'total_impostos_aoa')::numeric(18,4);
    v_bruto := (v_item->>'total_bruto_aoa')::numeric(18,4);

    IF v_product_code IS NULL OR v_tax_profile_code IS NULL OR v_tax_profile_version IS NULL THEN
      RAISE EXCEPTION 'DATA: item fiscal calculado sem product_code/tax_profile_code/tax_profile_version';
    END IF;

    IF v_product_number_code IS NULL THEN
      v_product_number_code := v_product_code;
    END IF;

    INSERT INTO public.fiscal_documento_itens (
      empresa_id,
      documento_id,
      linha_no,
      descricao,
      product_code,
      product_number_code,
      tax_profile_code,
      tax_profile_version,
      tax_type,
      tax_code,
      tax_country_region,
      operation_type,
      unit_of_measure,
      product_type,
      unit_price_base,
      settlement_amount,
      total_liquido_moeda,
      total_impostos_moeda,
      total_bruto_moeda,
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
      v_tax_profile_code,
      v_tax_profile_version,
      v_tax_type,
      v_tax_code,
      v_tax_country_region,
      v_operation_type,
      v_unit_of_measure,
      v_product_type,
      v_unit_price_base,
      v_settlement_amount,
      v_total_liquido_moeda,
      v_total_impostos_moeda,
      v_total_bruto_moeda,
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
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_emitir_recibo_pagamento(p_pagamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_claim_role text := COALESCE(current_setting('request.jwt.claim.role',true),'');
  v_pagamento public.pagamentos%ROWTYPE;
  v_existing_doc public.fiscal_documentos%ROWTYPE;
  v_empresa_id uuid;
  v_binding_count integer;
  v_serie public.fiscal_series%ROWTYPE;
  v_key public.fiscal_chaves%ROWTYPE;
  v_numero bigint;
  v_numero_formatado text;
  v_hash_anterior text;
  v_canonical text;
  v_hash_control text;
  v_documento_id uuid;
  v_total_gross numeric(18,2);
  v_total_net numeric(18,2);
  v_total_tax numeric(18,2);
  v_source_docs jsonb;
  v_cliente_nome text;
  v_cliente_nif text;
  v_cliente_country text;
  v_source_count integer;
  v_alloc record;
  v_line integer := 0;
  v_payment_mechanism text;
  v_invoice_date date := (statement_timestamp() AT TIME ZONE 'Africa/Luanda')::date;
BEGIN
  IF v_claim_role <> 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'AUTH: emissão de RC financeiro é exclusiva do backend';
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
    RAISE EXCEPTION 'STATE: pagamento precisa estar liquidado para emitir RC';
  END IF;

  SELECT d.*
    INTO v_existing_doc
  FROM public.financeiro_recibo_alocacoes ra
  JOIN public.fiscal_documentos d ON d.id=ra.recibo_documento_id
  WHERE ra.pagamento_id=v_pagamento.id
  ORDER BY ra.created_at
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'documento_id',v_existing_doc.id,
      'empresa_id',v_existing_doc.empresa_id,
      'numero',v_existing_doc.numero,
      'numero_formatado',v_existing_doc.numero_formatado,
      'hash_control',v_existing_doc.hash_control,
      'key_version',v_existing_doc.key_version,
      'status',v_existing_doc.status,
      'canonical_string',v_existing_doc.canonical_string
    );
  END IF;

  SELECT count(*)
    INTO v_source_count
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND a.fiscal_documento_origem_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id
        AND r.natureza='reversao'
    );

  IF v_source_count = 0 THEN
    RAISE EXCEPTION 'STATE: pagamento não possui documento fiscal origem; fluxo correcto é FR, não RC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_pagamento_alocacoes a
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id
          AND r.natureza='reversao'
      )
      AND (
        a.fiscal_documento_origem_id IS NULL
        OR a.valor_liquido_aoa IS NULL
        OR a.valor_imposto_aoa IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'STATE: pagamento possui alocações sem referência fiscal; RC não pode ser emitido';
  END IF;

  SELECT
    min(d.empresa_id::text)::uuid,
    count(DISTINCT d.empresa_id),
    min(d.cliente_nome),
    min(d.cliente_nif),
    count(DISTINCT COALESCE(d.cliente_nif,''))
  INTO
    v_empresa_id,
    v_binding_count,
    v_cliente_nome,
    v_cliente_nif,
    v_source_count
  FROM public.financeiro_pagamento_alocacoes a
  JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'STATE: documentos origem do pagamento pertencem a empresas fiscais diferentes';
  END IF;

  IF v_source_count <> 1 THEN
    RAISE EXCEPTION 'STATE: documentos origem do pagamento possuem clientes fiscais diferentes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_pagamento_alocacoes a
    JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
      )
      AND (
        d.tipo_documento NOT IN ('FT','ND')
        OR d.status <> 'emitido'
        OR d.moeda <> 'AOA'
      )
  ) THEN
    RAISE EXCEPTION 'STATE: RC requer documentos origem FT/ND emitidos em AOA';
  END IF;

  SELECT count(*)
    INTO v_binding_count
  FROM public.fiscal_escola_bindings b
  WHERE b.escola_id=v_pagamento.escola_id
    AND b.empresa_id=v_empresa_id
    AND b.fiscal_enabled IS TRUE
    AND b.effective_from <= v_invoice_date
    AND (b.effective_to IS NULL OR b.effective_to >= v_invoice_date);

  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'AUTH: vinculo fiscal activo e inequívoco obrigatório para RC';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM v_invoice_date)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL
  ORDER BY agt_provisioned_at DESC
  LIMIT 2;

  GET DIAGNOSTICS v_binding_count = ROW_COUNT;

  IF v_binding_count = 0 THEN
    RAISE EXCEPTION 'STATE: série RC provisionada pela AGT não encontrada';
  END IF;

  SELECT count(*)
    INTO v_binding_count
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM v_invoice_date)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL;

  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'STATE: é necessária exactamente uma série RC AGT activa para o ano corrente';
  END IF;

  SELECT *
    INTO STRICT v_serie
  FROM public.fiscal_series
  WHERE empresa_id=v_empresa_id
    AND tipo_documento='RC'
    AND agt_status='provisioned'
    AND series_year=EXTRACT(YEAR FROM v_invoice_date)::integer
    AND series_contingency_indicator='N'
    AND ativa=true
    AND descontinuada_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'STATE: série RC não encontrada'; END IF;
  SELECT numero,numero_formatado INTO v_numero,v_numero_formatado
  FROM fiscal_private.reserve_number(v_serie.id,v_empresa_id,'RC',v_invoice_date);

  SELECT *
    INTO v_key
  FROM public.fiscal_chaves
  WHERE empresa_id=v_empresa_id
    AND status='active'
  ORDER BY key_version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATE: chave fiscal activa não encontrada';
  END IF;

  SELECT
    round(sum(a.valor_bruto_aoa),2),
    round(sum(a.valor_liquido_aoa),2),
    round(sum(a.valor_imposto_aoa),2)
  INTO v_total_gross,v_total_net,v_total_tax
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  v_source_docs := '[]'::jsonb;

  FOR v_alloc IN
    SELECT
      a.id alocacao_id,
      a.valor_liquido_aoa,
      a.valor_imposto_aoa,
      a.valor_bruto_aoa,
      d.id source_id,
      d.numero_formatado,
      d.invoice_date,
      d.payload
    FROM public.financeiro_pagamento_alocacoes a
    JOIN public.fiscal_documentos d ON d.id=a.fiscal_documento_origem_id
    WHERE a.pagamento_id=v_pagamento.id
      AND a.natureza='aplicacao'
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_pagamento_alocacoes r
        WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
      )
    ORDER BY a.created_at,a.id
  LOOP
    v_line := v_line + 1;
    v_source_docs := v_source_docs || jsonb_build_array(
      jsonb_build_object(
        'lineNo',v_line,
        'sourceDocumentID',jsonb_build_object(
          'OriginatingON',v_alloc.numero_formatado,
          'documentDate',v_alloc.invoice_date
        ),
        'creditAmount',v_alloc.valor_liquido_aoa,
        'allocationId',v_alloc.alocacao_id
      )
    );

    IF v_line=1 THEN
      v_cliente_country := upper(
        COALESCE(NULLIF(v_alloc.payload->'cliente'->>'country',''),'AO')
      );
    END IF;
  END LOOP;

  IF v_cliente_country !~ '^[A-Z]{2}$' THEN
    v_cliente_country := 'AO';
  END IF;

  v_payment_mechanism := CASE v_pagamento.metodo::text
    WHEN 'cash' THEN 'NU'
    WHEN 'transfer' THEN 'TB'
    WHEN 'tpa' THEN 'MB'
    WHEN 'mcx' THEN 'MB'
    WHEN 'kwik' THEN 'MB'
    ELSE NULL
  END;

  SELECT hash_control
    INTO v_hash_anterior
  FROM public.fiscal_documentos
  WHERE serie_id=v_serie.id
  ORDER BY numero DESC
  LIMIT 1;

  v_canonical := jsonb_build_object(
    'empresa_id',v_empresa_id,
    'serie_id',v_serie.id,
    'numero',v_numero,
    'numero_formatado',v_numero_formatado,
    'tipo_documento','RC',
    'invoice_date',v_invoice_date,
    'moeda','AOA',
    'payment_mechanism',v_payment_mechanism,
    'total_bruto_aoa',v_total_gross,
    'total_impostos_aoa',v_total_tax,
    'total_liquido_aoa',v_total_net,
    'hash_anterior',v_hash_anterior,
    'cliente_nome',v_cliente_nome,
    'cliente_nif',v_cliente_nif,
    'sourceDocuments',v_source_docs
  )::text;

  v_hash_control := encode(extensions.digest(v_canonical,'sha256'),'hex');

  INSERT INTO public.fiscal_documentos (
    empresa_id,serie_id,tipo_documento,numero,numero_formatado,
    cliente_nome,cliente_nif,invoice_date,moeda,taxa_cambio_aoa,
    payment_mechanism,total_bruto_aoa,total_impostos_aoa,total_liquido_aoa,
    hash_anterior,assinatura_base64,hash_control,canonical_string,key_version,
    status,documento_origem_id,rectifica_documento_id,payload,created_by
  )
  VALUES (
    v_empresa_id,v_serie.id,'RC',v_numero,v_numero_formatado,
    COALESCE(v_cliente_nome,'Consumidor final'),
    COALESCE(v_cliente_nif,'999999999'),
    v_invoice_date,'AOA',NULL,
    v_payment_mechanism,v_total_gross,v_total_tax,v_total_net,
    v_hash_anterior,NULL,v_hash_control,v_canonical,v_key.key_version,
    'pendente_assinatura',NULL,NULL,
    jsonb_build_object(
      'cliente',jsonb_build_object(
        'nome',COALESCE(v_cliente_nome,'Consumidor final'),
        'nif',COALESCE(v_cliente_nif,'999999999'),
        'country',v_cliente_country
      ),
      'paymentReceipt',jsonb_build_object(
        'sourceDocuments',v_source_docs
      ),
      'metadata',jsonb_build_object(
        'origem_integracao','financeiro_pagamento_rc_v1',
        'origem_operacao','financeiro_pagamento_rc',
        'origem_id',v_pagamento.id::text,
        'pagamento_id',v_pagamento.id,
        'payment_mechanism_local',v_payment_mechanism,
        'allocation_model','proportional_residual_v1'
      )
    ),
    COALESCE(v_pagamento.settled_by,v_pagamento.created_by)
  )
  RETURNING id INTO v_documento_id;

  INSERT INTO public.financeiro_recibo_alocacoes (
    escola_id,pagamento_id,recibo_documento_id,alocacao_id,
    fiscal_documento_origem_id,valor_bruto_aoa,valor_liquido_aoa,valor_imposto_aoa
  )
  SELECT
    v_pagamento.escola_id,
    v_pagamento.id,
    v_documento_id,
    a.id,
    a.fiscal_documento_origem_id,
    a.valor_bruto_aoa,
    a.valor_liquido_aoa,
    a.valor_imposto_aoa
  FROM public.financeiro_pagamento_alocacoes a
  WHERE a.pagamento_id=v_pagamento.id
    AND a.natureza='aplicacao'
    AND a.fiscal_documento_origem_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamento_alocacoes r
      WHERE r.alocacao_origem_id=a.id AND r.natureza='reversao'
    );

  INSERT INTO public.financeiro_fiscal_links (
    escola_id,empresa_id,origem_tipo,origem_id,fiscal_documento_id,
    status,idempotency_key,payload_snapshot,fiscal_error
  )
  VALUES (
    v_pagamento.escola_id,v_empresa_id,'financeiro_pagamento_rc',
    v_pagamento.id::text,v_documento_id,'pending',
    format('financeiro_pagamento_rc:%s',v_pagamento.id),
    jsonb_build_object(
      'pagamento_id',v_pagamento.id,
      'sourceDocuments',v_source_docs,
      'total_bruto_aoa',v_total_gross,
      'total_liquido_aoa',v_total_net,
      'total_impostos_aoa',v_total_tax
    ),
    NULL
  )
  ON CONFLICT (origem_tipo,origem_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'documento_id',v_documento_id,
    'empresa_id',v_empresa_id,
    'numero',v_numero,
    'numero_formatado',v_numero_formatado,
    'hash_control',v_hash_control,
    'key_version',v_key.key_version,
    'status','pendente_assinatura',
    'canonical_string',v_canonical,
    'total_bruto_aoa',v_total_gross,
    'total_liquido_aoa',v_total_net,
    'total_impostos_aoa',v_total_tax,
    'source_documents',v_source_docs
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_require_agt_series_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_serie public.fiscal_series%ROWTYPE;
  v_is_fe boolean;
BEGIN
  SELECT *
  INTO v_serie
  FROM public.fiscal_series
  WHERE id=NEW.serie_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série fiscal não encontrada';
  END IF;

  IF v_serie.empresa_id IS DISTINCT FROM NEW.empresa_id
     OR v_serie.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
    RAISE EXCEPTION 'DATA: série fiscal incompatível com o documento';
  END IF;

  v_is_fe := NEW.tipo_documento IN ('FT','FR','FG','GF','NC','ND','RC','RE');

  IF v_is_fe THEN
    IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
       OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL
       OR v_serie.agt_submission_uuid IS NULL
       OR v_serie.agt_provisioned_at IS NULL THEN
      RAISE EXCEPTION 'STATE: documento FE exige série provisionada pela AGT';
    END IF;

    IF v_serie.series_year
       IS DISTINCT FROM extract(year from NEW.invoice_date)::integer THEN
      RAISE EXCEPTION 'STATE: ano da série AGT diverge da data do documento';
    END IF;

    IF v_serie.series_contingency_indicator NOT IN ('N','C') THEN
      RAISE EXCEPTION 'STATE: indicador de contingência da série AGT inválido';
    END IF;

    IF (v_serie.origem_documento='contingencia')
       IS DISTINCT FROM (v_serie.series_contingency_indicator='C') THEN
      RAISE EXCEPTION
        'STATE: origem contingência e seriesContingencyIndicator devem ser coerentes';
    END IF;

    NEW.contingency_indicator := v_serie.series_contingency_indicator;
  ELSIF NEW.tipo_documento IN ('PP','GR','GT') THEN
    IF v_serie.agt_status IS DISTINCT FROM 'legacy' THEN
      RAISE EXCEPTION
        'STATE: PP/GR/GT usam série local controlada e não série de Facturação Electrónica';
    END IF;

    IF v_serie.origem_documento='contingencia'
       OR coalesce(v_serie.series_contingency_indicator,'N')<>'N' THEN
      RAISE EXCEPTION
        'STATE: PP/GR/GT não podem usar série FE de contingência';
    END IF;

    NEW.contingency_indicator := 'N';
  ELSE
    RAISE EXCEPTION
      'STATE: tipo de documento % não possui política de série definida',
      NEW.tipo_documento;
  END IF;

  IF NEW.numero IS DISTINCT FROM v_serie.ultimo_numero OR NEW.numero IS NULL OR NEW.numero<1 OR
     NEW.numero_formatado IS DISTINCT FROM fiscal_private.format_number(NEW.tipo_documento,coalesce(v_serie.agt_series_code,''),v_serie.prefixo,NEW.numero) THEN
    RAISE EXCEPTION 'STATE: número fiscal não corresponde à reserva central';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fiscal_emitir_documento(uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text,text),public.fiscal_emitir_recibo_pagamento(uuid),public.fiscal_reservar_numero_serie(uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
