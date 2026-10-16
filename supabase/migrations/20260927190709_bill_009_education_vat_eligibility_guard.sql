ALTER TABLE public.fiscal_empresas
  ADD COLUMN IF NOT EXISTS education_vat_exemption_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS education_vat_exemption_basis text NULL,
  ADD COLUMN IF NOT EXISTS education_vat_exemption_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS education_vat_exemption_verified_by uuid NULL;

ALTER TABLE public.fiscal_empresas
  DROP CONSTRAINT IF EXISTS fiscal_empresas_education_vat_exemption_status_chk,
  DROP CONSTRAINT IF EXISTS fiscal_empresas_education_vat_exemption_evidence_chk;

ALTER TABLE public.fiscal_empresas
  ADD CONSTRAINT fiscal_empresas_education_vat_exemption_status_chk
  CHECK (education_vat_exemption_status IN ('unverified','eligible','not_eligible')),
  ADD CONSTRAINT fiscal_empresas_education_vat_exemption_evidence_chk
  CHECK (
    (
      education_vat_exemption_status = 'unverified'
      AND education_vat_exemption_basis IS NULL
      AND education_vat_exemption_verified_at IS NULL
      AND education_vat_exemption_verified_by IS NULL
    )
    OR
    (
      education_vat_exemption_status IN ('eligible','not_eligible')
      AND nullif(btrim(education_vat_exemption_basis),'') IS NOT NULL
      AND education_vat_exemption_verified_at IS NOT NULL
      AND education_vat_exemption_verified_by IS NOT NULL
    )
  );

COMMENT ON COLUMN public.fiscal_empresas.education_vat_exemption_status IS
  'BILL-009: elegibilidade explícita para IVA educação/M21. unverified é fail-closed; nunca inferir pelo tipo/nome do tenant.';

ALTER TABLE public.financeiro_tabelas
  ALTER COLUMN tax_profile_code DROP DEFAULT,
  ALTER COLUMN tax_profile_code DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fiscal_guard_education_vat_exemption_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed :=
      NEW.education_vat_exemption_status IS DISTINCT FROM 'unverified'
      OR NEW.education_vat_exemption_basis IS NOT NULL
      OR NEW.education_vat_exemption_verified_at IS NOT NULL
      OR NEW.education_vat_exemption_verified_by IS NOT NULL;
  ELSE
    v_changed :=
      NEW.education_vat_exemption_status IS DISTINCT FROM OLD.education_vat_exemption_status
      OR NEW.education_vat_exemption_basis IS DISTINCT FROM OLD.education_vat_exemption_basis
      OR NEW.education_vat_exemption_verified_at IS DISTINCT FROM OLD.education_vat_exemption_verified_at
      OR NEW.education_vat_exemption_verified_by IS DISTINCT FROM OLD.education_vat_exemption_verified_by;
  END IF;

  IF v_changed
     AND current_user <> 'postgres'
     AND NOT coalesce(public.check_super_admin_role(), false) THEN
    RAISE EXCEPTION
      'AUTH: classificação de elegibilidade M21 só pode ser alterada por super administrador';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fiscal_empresas_guard_education_vat_exemption
  ON public.fiscal_empresas;
CREATE TRIGGER trg_fiscal_empresas_guard_education_vat_exemption
BEFORE INSERT OR UPDATE ON public.fiscal_empresas
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_guard_education_vat_exemption_fields();

CREATE OR REPLACE FUNCTION public.fiscal_set_education_vat_exemption_status(
  p_empresa_id uuid,
  p_status text,
  p_basis text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_basis text := nullif(btrim(coalesce(p_basis,'')), '');
  v_uid uuid := public.safe_auth_uid();
BEGIN
  IF v_uid IS NULL OR NOT coalesce(public.check_super_admin_role(), false) THEN
    RAISE EXCEPTION
      'AUTH: apenas super administrador pode validar elegibilidade M21';
  END IF;

  IF v_status NOT IN ('unverified','eligible','not_eligible') THEN
    RAISE EXCEPTION 'DATA: status de elegibilidade M21 inválido';
  END IF;

  IF v_status IN ('eligible','not_eligible') AND v_basis IS NULL THEN
    RAISE EXCEPTION
      'DATA: fundamento/evidência é obrigatório para decisão de elegibilidade M21';
  END IF;

  UPDATE public.fiscal_empresas
  SET
    education_vat_exemption_status = v_status,
    education_vat_exemption_basis = CASE WHEN v_status='unverified' THEN NULL ELSE v_basis END,
    education_vat_exemption_verified_at = CASE WHEN v_status='unverified' THEN NULL ELSE now() END,
    education_vat_exemption_verified_by = CASE WHEN v_status='unverified' THEN NULL ELSE v_uid END,
    updated_at = now()
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: empresa fiscal não encontrada';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'education_vat_exemption_status', v_status
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fiscal_set_education_vat_exemption_status(uuid,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_set_education_vat_exemption_status(uuid,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fiscal_assert_tax_profile_eligibility(
  p_empresa_id uuid,
  p_tax_profile_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_status text;
  v_basis text;
  v_verified_at timestamptz;
  v_verified_by uuid;
BEGIN
  IF p_tax_profile_code IS DISTINCT FROM 'IVA_EDUCACAO_M21' THEN
    RETURN;
  END IF;

  SELECT
    education_vat_exemption_status,
    education_vat_exemption_basis,
    education_vat_exemption_verified_at,
    education_vat_exemption_verified_by
  INTO
    v_status,
    v_basis,
    v_verified_at,
    v_verified_by
  FROM public.fiscal_empresas
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: empresa fiscal não encontrada';
  END IF;

  IF v_status IS DISTINCT FROM 'eligible'
     OR nullif(btrim(coalesce(v_basis,'')),'') IS NULL
     OR v_verified_at IS NULL
     OR v_verified_by IS NULL THEN
    RAISE EXCEPTION
      'STATE: perfil IVA_EDUCACAO_M21 exige elegibilidade fiscal de ensino previamente verificada para a empresa';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fiscal_assert_tax_profile_eligibility(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_validate_item_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_documento_empresa_id uuid;
  v_invoice_date date;
  v_payload_profile_code text;
  v_payload_profile_version integer;
  v_profile public.fiscal_tax_profiles%ROWTYPE;
BEGIN
  SELECT
    d.empresa_id,
    d.invoice_date,
    nullif(btrim(coalesce(d.payload->'itens'->(NEW.linha_no - 1)->>'tax_profile_code','')), ''),
    nullif(d.payload->'itens'->(NEW.linha_no - 1)->>'tax_profile_version','')::integer
  INTO
    v_documento_empresa_id,
    v_invoice_date,
    v_payload_profile_code,
    v_payload_profile_version
  FROM public.fiscal_documentos d
  WHERE d.id = NEW.documento_id;

  IF v_documento_empresa_id IS NULL THEN
    RAISE EXCEPTION 'DATA: documento fiscal inválido';
  END IF;

  IF v_documento_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'TENANT: empresa do item divergente da empresa do documento';
  END IF;

  IF NEW.tax_profile_code IS NULL THEN
    RAISE EXCEPTION 'DATA: tax_profile_code obrigatório em novas linhas fiscais';
  END IF;

  PERFORM public.fiscal_assert_tax_profile_eligibility(
    NEW.empresa_id,
    NEW.tax_profile_code
  );

  IF NEW.tax_profile_version IS NULL THEN
    NEW.tax_profile_version := v_payload_profile_version;
  END IF;

  IF NEW.tax_profile_version IS NULL OR NEW.tax_profile_version <= 0 THEN
    RAISE EXCEPTION 'DATA: tax_profile_version obrigatório em novas linhas fiscais';
  END IF;

  IF v_payload_profile_code IS NOT NULL
     AND v_payload_profile_code IS DISTINCT FROM NEW.tax_profile_code THEN
    RAISE EXCEPTION
      'DATA: tax_profile_code da linha diverge do snapshot fiscal do documento';
  END IF;

  IF v_payload_profile_version IS NOT NULL
     AND v_payload_profile_version IS DISTINCT FROM NEW.tax_profile_version THEN
    RAISE EXCEPTION
      'DATA: tax_profile_version da linha diverge do snapshot fiscal do documento';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.fiscal_tax_profiles p
  WHERE p.code = NEW.tax_profile_code
    AND p.version = NEW.tax_profile_version
    AND p.valid_from <= v_invoice_date
    AND (p.valid_to IS NULL OR p.valid_to >= v_invoice_date);

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'DATA: perfil tributário %.v% não é válido em %',
      NEW.tax_profile_code, NEW.tax_profile_version, v_invoice_date;
  END IF;

  IF NEW.tax_type IS DISTINCT FROM v_profile.tax_type
     OR NEW.tax_code IS DISTINCT FROM v_profile.tax_code
     OR NEW.tax_country_region IS DISTINCT FROM v_profile.tax_country_region
     OR abs(NEW.taxa_iva - v_profile.tax_percentage) > 0.0001 THEN
    RAISE EXCEPTION
      'DATA: snapshot tributário da linha diverge do perfil %.v%',
      v_profile.code, v_profile.version;
  END IF;

  IF v_profile.operation_type IS NOT NULL
     AND NEW.operation_type IS DISTINCT FROM v_profile.operation_type THEN
    RAISE EXCEPTION
      'DATA: operation_type da linha diverge do perfil %.v%',
      v_profile.code, v_profile.version;
  END IF;

  IF v_profile.tax_code = 'ISE' THEN
    IF NEW.tax_exemption_code IS DISTINCT FROM v_profile.exemption_code
       OR NEW.tax_exemption_reason IS DISTINCT FROM v_profile.exemption_reason THEN
      RAISE EXCEPTION
        'DATA: isenção da linha diverge do perfil %.v%',
        v_profile.code, v_profile.version;
    END IF;
  ELSIF NEW.tax_exemption_code IS NOT NULL OR NEW.tax_exemption_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'DATA: perfil tributável %.v% não aceita dados de isenção',
      v_profile.code, v_profile.version;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.fiscal_guard_education_vat_exemption_fields()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_validate_item_consistency()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fiscal_emitir_documento(p_empresa_id uuid, p_serie_id uuid, p_tipo_documento text, p_prefixo_serie text, p_origem_documento text, p_cliente jsonb, p_invoice_date date, p_moeda text, p_itens jsonb, p_documento_origem_id uuid DEFAULT NULL::uuid, p_rectifica_documento_id uuid DEFAULT NULL::uuid, p_taxa_cambio_aoa numeric DEFAULT NULL::numeric, p_metadata jsonb DEFAULT '{}'::jsonb, p_assinatura_base64 text DEFAULT NULL::text, p_payment_mechanism text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
REVOKE ALL ON FUNCTION public.fiscal_emitir_documento(
  uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_emitir_documento(
  uuid,uuid,text,text,text,jsonb,date,text,jsonb,uuid,uuid,numeric,jsonb,text,text
) TO authenticated, service_role;
