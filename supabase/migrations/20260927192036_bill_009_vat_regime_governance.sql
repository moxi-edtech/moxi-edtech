
ALTER TABLE public.fiscal_empresas
  ADD COLUMN IF NOT EXISTS vat_regime_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS vat_regime_basis text NULL,
  ADD COLUMN IF NOT EXISTS vat_regime_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS vat_regime_verified_by uuid NULL;

ALTER TABLE public.fiscal_empresas
  DROP CONSTRAINT IF EXISTS fiscal_empresas_vat_regime_status_chk,
  DROP CONSTRAINT IF EXISTS fiscal_empresas_vat_regime_evidence_chk;

ALTER TABLE public.fiscal_empresas
  ADD CONSTRAINT fiscal_empresas_vat_regime_status_chk
  CHECK (vat_regime_status IN ('unverified','general','simplified','exclusion')),
  ADD CONSTRAINT fiscal_empresas_vat_regime_evidence_chk
  CHECK (
    (
      vat_regime_status='unverified'
      AND vat_regime_basis IS NULL
      AND vat_regime_verified_at IS NULL
      AND vat_regime_verified_by IS NULL
    )
    OR
    (
      vat_regime_status IN ('general','simplified','exclusion')
      AND nullif(btrim(vat_regime_basis),'') IS NOT NULL
      AND vat_regime_verified_at IS NOT NULL
      AND vat_regime_verified_by IS NOT NULL
    )
  );

COMMENT ON COLUMN public.fiscal_empresas.vat_regime_status IS
  'BILL-009: regime IVA verificado da entidade. Não inferir por faturação, tenant_type ou actividade.';

INSERT INTO public.fiscal_tax_profiles (
  code,version,tax_type,tax_code,tax_country_region,tax_percentage,
  exemption_code,exemption_reason,operation_type,
  valid_from,valid_to,legal_reference,legal_source_url,system_managed,metadata
)
VALUES
(
  'IVA_SIMPLIFICADO_M00',1,'IVA','ISE','AO',0,
  'M00','IVA - Regime Simplificado',NULL,
  DATE '2026-01-01',NULL,
  'AGT Anexo 6.4 - M00 IVA Regime Simplificado',
  'https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/anexos.html',
  true,
  '{"scope":"vat_regime","vat_regime":"simplified","agt_exemption_annex":"6.4","supported_from":"2026-01-01"}'::jsonb
),
(
  'IVA_EXCLUSAO_M04',1,'IVA','ISE','AO',0,
  'M04','IVA - Regime de Exclusão',NULL,
  DATE '2026-01-01',NULL,
  'AGT Anexo 6.4 - M04 IVA Regime de Exclusão',
  'https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/anexos.html',
  true,
  '{"scope":"vat_regime","vat_regime":"exclusion","agt_exemption_annex":"6.4","supported_from":"2026-01-01"}'::jsonb
)
ON CONFLICT (code,version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fiscal_guard_vat_regime_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    v_changed :=
      NEW.vat_regime_status IS DISTINCT FROM 'unverified'
      OR NEW.vat_regime_basis IS NOT NULL
      OR NEW.vat_regime_verified_at IS NOT NULL
      OR NEW.vat_regime_verified_by IS NOT NULL;
  ELSE
    v_changed :=
      NEW.vat_regime_status IS DISTINCT FROM OLD.vat_regime_status
      OR NEW.vat_regime_basis IS DISTINCT FROM OLD.vat_regime_basis
      OR NEW.vat_regime_verified_at IS DISTINCT FROM OLD.vat_regime_verified_at
      OR NEW.vat_regime_verified_by IS DISTINCT FROM OLD.vat_regime_verified_by;
  END IF;

  IF v_changed
     AND current_user <> 'postgres'
     AND NOT coalesce(public.check_super_admin_role(),false) THEN
    RAISE EXCEPTION 'AUTH: regime IVA só pode ser alterado por super administrador';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fiscal_empresas_guard_vat_regime
ON public.fiscal_empresas;
CREATE TRIGGER trg_fiscal_empresas_guard_vat_regime
BEFORE INSERT OR UPDATE ON public.fiscal_empresas
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_guard_vat_regime_fields();

CREATE OR REPLACE FUNCTION public.fiscal_set_vat_regime_status(
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
  v_basis text := nullif(btrim(coalesce(p_basis,'')),'');
  v_uid uuid := public.safe_auth_uid();
BEGIN
  IF v_uid IS NULL OR NOT coalesce(public.check_super_admin_role(),false) THEN
    RAISE EXCEPTION 'AUTH: apenas super administrador pode validar o regime IVA';
  END IF;

  IF v_status NOT IN ('unverified','general','simplified','exclusion') THEN
    RAISE EXCEPTION 'DATA: regime IVA inválido';
  END IF;

  IF v_status <> 'unverified' AND v_basis IS NULL THEN
    RAISE EXCEPTION 'DATA: fundamento/evidência é obrigatório para validar o regime IVA';
  END IF;

  UPDATE public.fiscal_empresas
  SET
    vat_regime_status=v_status,
    vat_regime_basis=CASE WHEN v_status='unverified' THEN NULL ELSE v_basis END,
    vat_regime_verified_at=CASE WHEN v_status='unverified' THEN NULL ELSE now() END,
    vat_regime_verified_by=CASE WHEN v_status='unverified' THEN NULL ELSE v_uid END,
    updated_at=now()
  WHERE id=p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: empresa fiscal não encontrada';
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'empresa_id',p_empresa_id,
    'vat_regime_status',v_status
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fiscal_set_vat_regime_status(uuid,text,text)
FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_set_vat_regime_status(uuid,text,text)
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
  v_vat_regime text;
  v_education_status text;
  v_education_basis text;
  v_education_verified_at timestamptz;
  v_education_verified_by uuid;
BEGIN
  SELECT
    vat_regime_status,
    education_vat_exemption_status,
    education_vat_exemption_basis,
    education_vat_exemption_verified_at,
    education_vat_exemption_verified_by
  INTO
    v_vat_regime,
    v_education_status,
    v_education_basis,
    v_education_verified_at,
    v_education_verified_by
  FROM public.fiscal_empresas
  WHERE id=p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: empresa fiscal não encontrada';
  END IF;

  IF p_tax_profile_code='IVA_EDUCACAO_M21' THEN
    IF v_vat_regime NOT IN ('general','simplified') THEN
      RAISE EXCEPTION
        'STATE: perfil IVA_EDUCACAO_M21 exige regime IVA geral ou simplificado previamente verificado';
    END IF;
    IF v_education_status IS DISTINCT FROM 'eligible'
       OR nullif(btrim(coalesce(v_education_basis,'')),'') IS NULL
       OR v_education_verified_at IS NULL
       OR v_education_verified_by IS NULL THEN
      RAISE EXCEPTION
        'STATE: perfil IVA_EDUCACAO_M21 exige elegibilidade fiscal de ensino previamente verificada';
    END IF;
    RETURN;
  END IF;

  IF p_tax_profile_code='IVA_NORMAL_14_AO' THEN
    IF v_vat_regime IS DISTINCT FROM 'general' THEN
      RAISE EXCEPTION
        'STATE: perfil IVA_NORMAL_14_AO exige entidade enquadrada no regime geral do IVA';
    END IF;
    RETURN;
  END IF;

  IF p_tax_profile_code='IVA_SIMPLIFICADO_M00' THEN
    IF v_vat_regime IS DISTINCT FROM 'simplified' THEN
      RAISE EXCEPTION
        'STATE: perfil IVA_SIMPLIFICADO_M00 exige entidade enquadrada no regime simplificado do IVA';
    END IF;
    RETURN;
  END IF;

  IF p_tax_profile_code='IVA_EXCLUSAO_M04' THEN
    IF v_vat_regime IS DISTINCT FROM 'exclusion' THEN
      RAISE EXCEPTION
        'STATE: perfil IVA_EXCLUSAO_M04 exige entidade enquadrada no regime de exclusão do IVA';
    END IF;
    RETURN;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.fiscal_assert_tax_profile_eligibility(uuid,text)
FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.fiscal_resolve_education_tax_profile(
  p_empresa_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_vat_regime text;
  v_education_status text;
BEGIN
  SELECT vat_regime_status,education_vat_exemption_status
  INTO v_vat_regime,v_education_status
  FROM public.fiscal_empresas
  WHERE id=p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH: empresa fiscal indisponível para o utilizador';
  END IF;

  IF v_vat_regime='unverified' THEN
    RAISE EXCEPTION 'STATE: regime IVA da entidade fiscal ainda não foi verificado';
  END IF;

  IF v_vat_regime='exclusion' THEN
    RETURN 'IVA_EXCLUSAO_M04';
  END IF;

  IF v_education_status='unverified' THEN
    RAISE EXCEPTION 'STATE: elegibilidade da isenção de ensino M21 ainda não foi verificada';
  END IF;

  IF v_education_status='eligible' THEN
    RETURN 'IVA_EDUCACAO_M21';
  END IF;

  IF v_vat_regime='simplified' THEN
    RETURN 'IVA_SIMPLIFICADO_M00';
  END IF;

  IF v_vat_regime='general' THEN
    RETURN 'IVA_NORMAL_14_AO';
  END IF;

  RAISE EXCEPTION 'STATE: combinação de regime IVA e ensino não suportada';
END;
$fn$;

REVOKE ALL ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
TO service_role;

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
  v_vat_regime text;
  v_education_status text;
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
  WHERE d.id=NEW.documento_id;

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

  SELECT vat_regime_status,education_vat_exemption_status
  INTO v_vat_regime,v_education_status
  FROM public.fiscal_empresas
  WHERE id=NEW.empresa_id;

  IF NEW.operation_type='SE'
     AND v_vat_regime IN ('general','simplified') THEN
    IF v_education_status='unverified' THEN
      RAISE EXCEPTION
        'STATE: emissão de serviço de ensino exige decisão explícita sobre elegibilidade M21';
    END IF;
    IF v_education_status='eligible'
       AND NEW.tax_profile_code IS DISTINCT FROM 'IVA_EDUCACAO_M21' THEN
      RAISE EXCEPTION
        'STATE: serviço de ensino elegível para M21 não pode ser emitido com perfil tributário incompatível';
    END IF;
  END IF;

  IF NEW.tax_profile_version IS NULL THEN
    NEW.tax_profile_version:=v_payload_profile_version;
  END IF;

  IF NEW.tax_profile_version IS NULL OR NEW.tax_profile_version<=0 THEN
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
  WHERE p.code=NEW.tax_profile_code
    AND p.version=NEW.tax_profile_version
    AND p.valid_from<=v_invoice_date
    AND (p.valid_to IS NULL OR p.valid_to>=v_invoice_date);

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'DATA: perfil tributário %.v% não é válido em %',
      NEW.tax_profile_code,NEW.tax_profile_version,v_invoice_date;
  END IF;

  IF NEW.tax_type IS DISTINCT FROM v_profile.tax_type
     OR NEW.tax_code IS DISTINCT FROM v_profile.tax_code
     OR NEW.tax_country_region IS DISTINCT FROM v_profile.tax_country_region
     OR abs(NEW.taxa_iva-v_profile.tax_percentage)>0.0001 THEN
    RAISE EXCEPTION
      'DATA: snapshot tributário da linha diverge do perfil %.v%',
      v_profile.code,v_profile.version;
  END IF;

  IF v_profile.operation_type IS NOT NULL
     AND NEW.operation_type IS DISTINCT FROM v_profile.operation_type THEN
    RAISE EXCEPTION
      'DATA: operation_type da linha diverge do perfil %.v%',
      v_profile.code,v_profile.version;
  END IF;

  IF v_profile.tax_code='ISE' THEN
    IF NEW.tax_exemption_code IS DISTINCT FROM v_profile.exemption_code
       OR NEW.tax_exemption_reason IS DISTINCT FROM v_profile.exemption_reason THEN
      RAISE EXCEPTION
        'DATA: isenção da linha diverge do perfil %.v%',
        v_profile.code,v_profile.version;
    END IF;
  ELSIF NEW.tax_exemption_code IS NOT NULL OR NEW.tax_exemption_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'DATA: perfil tributável %.v% não aceita dados de isenção',
      v_profile.code,v_profile.version;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.fiscal_guard_vat_regime_fields()
FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_validate_item_consistency()
FROM PUBLIC,anon,authenticated,service_role;
