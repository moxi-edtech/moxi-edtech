ALTER TABLE public.fiscal_documento_itens
  ADD COLUMN IF NOT EXISTS tax_profile_version integer NULL;

ALTER TABLE public.fiscal_documento_itens
  ADD CONSTRAINT fiscal_documento_itens_tax_profile_version_positive_chk
  CHECK (tax_profile_version IS NULL OR tax_profile_version > 0) NOT VALID;

ALTER TABLE public.fiscal_documento_itens
  ADD CONSTRAINT fiscal_documento_itens_tax_profile_snapshot_chk
  CHECK (
    (tax_profile_code IS NULL AND tax_profile_version IS NULL)
    OR
    (tax_profile_code IS NOT NULL AND tax_profile_version IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.fiscal_documento_itens
  ADD CONSTRAINT fiscal_documento_itens_tax_profile_fk
  FOREIGN KEY (tax_profile_code, tax_profile_version)
  REFERENCES public.fiscal_tax_profiles(code, version)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_fiscal_documento_itens_tax_profile_version
  ON public.fiscal_documento_itens(tax_profile_code, tax_profile_version)
  WHERE tax_profile_code IS NOT NULL;

ALTER TABLE public.fiscal_tax_profiles
  ADD CONSTRAINT fiscal_tax_profiles_version_positive_chk
  CHECK (version > 0);

ALTER TABLE public.fiscal_tax_profiles
  ADD CONSTRAINT fiscal_tax_profiles_no_overlap_excl
  EXCLUDE USING gist (
    code WITH =,
    daterange(valid_from, valid_to, '[]') WITH &&
  );

CREATE OR REPLACE FUNCTION public.fiscal_guard_tax_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.fiscal_documento_itens i
    WHERE i.tax_profile_code = OLD.code
      AND i.tax_profile_version = OLD.version
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'STATE: perfil tributário %.v% já foi usado por documento fiscal e é imutável',
      OLD.code, OLD.version;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fiscal_tax_profiles_immutable_when_used
  ON public.fiscal_tax_profiles;
CREATE TRIGGER trg_fiscal_tax_profiles_immutable_when_used
BEFORE UPDATE OR DELETE ON public.fiscal_tax_profiles
FOR EACH ROW
EXECUTE FUNCTION public.fiscal_guard_tax_profile_mutation();

CREATE OR REPLACE FUNCTION public.fiscal_block_tax_profile_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $fn$
BEGIN
  RAISE EXCEPTION 'STATE: catálogo tributário não pode ser truncado';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_fiscal_tax_profiles_no_truncate
  ON public.fiscal_tax_profiles;
CREATE TRIGGER trg_fiscal_tax_profiles_no_truncate
BEFORE TRUNCATE ON public.fiscal_tax_profiles
FOR EACH STATEMENT
EXECUTE FUNCTION public.fiscal_block_tax_profile_truncate();

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

REVOKE EXECUTE ON FUNCTION public.fiscal_guard_tax_profile_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_block_tax_profile_truncate()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_validate_item_consistency()
  FROM PUBLIC, anon, authenticated, service_role;
