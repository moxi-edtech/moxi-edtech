BEGIN;

CREATE TABLE IF NOT EXISTS public.fiscal_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  tax_type text NOT NULL DEFAULT 'IVA',
  tax_code text NULL,
  tax_country_region text NOT NULL DEFAULT 'AO',
  tax_percentage numeric(7,4) NOT NULL DEFAULT 0,
  tax_amount numeric(18,4) NULL,
  exemption_code text NULL,
  exemption_reason text NULL,
  operation_type text NULL,
  valid_from date NOT NULL,
  valid_to date NULL,
  legal_reference text NOT NULL,
  legal_source_url text NULL,
  system_managed boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_tax_profiles_code_version_uk UNIQUE(code,version),
  CONSTRAINT fiscal_tax_profiles_dates_chk CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT fiscal_tax_profiles_percentage_chk CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  CONSTRAINT fiscal_tax_profiles_region_chk CHECK (
    tax_country_region ~ '^(?:[A-Z]{2}|AO-CAB)$'
  ),
  CONSTRAINT fiscal_tax_profiles_tax_type_chk CHECK (
    tax_type IN ('IVA','IS','IEC','CEOC','NS')
  ),
  CONSTRAINT fiscal_tax_profiles_iva_code_chk CHECK (
    tax_type <> 'IVA'
    OR tax_code IN ('NOR','INT','RED','ISE','OUT')
  ),
  CONSTRAINT fiscal_tax_profiles_exemption_chk CHECK (
    (tax_code = 'ISE' AND tax_percentage = 0
      AND exemption_code ~ '^M[0-9]{2}$'
      AND nullif(btrim(exemption_reason),'') IS NOT NULL)
    OR
    (tax_code IS DISTINCT FROM 'ISE' AND exemption_code IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_tax_profiles_open_code
  ON public.fiscal_tax_profiles(code)
  WHERE valid_to IS NULL;

ALTER TABLE public.fiscal_tax_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_tax_profiles_select ON public.fiscal_tax_profiles;
CREATE POLICY fiscal_tax_profiles_select
ON public.fiscal_tax_profiles
FOR SELECT TO authenticated
USING (true);

REVOKE ALL ON TABLE public.fiscal_tax_profiles
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.fiscal_tax_profiles TO authenticated, service_role;

INSERT INTO public.fiscal_tax_profiles (
  code,version,tax_type,tax_code,tax_country_region,tax_percentage,
  exemption_code,exemption_reason,operation_type,valid_from,
  legal_reference,legal_source_url,metadata
)
VALUES
(
  'IVA_EDUCACAO_M21',1,'IVA','ISE','AO',0,
  'M21','Ensino isento - al. l), n. 1 do art. 12 do CIVA','SE','2024-01-01',
  'CIVA art. 12 n.1 al. l) - servicos de ensino',
  'https://portaldocontribuinte.minfin.gov.ao/impostos-e-taxas/imposto-sobre-valor-acrescentado',
  '{"scope":"education_service","agt_exemption_annex":"6.4"}'::jsonb
),
(
  'IVA_NORMAL_14_AO',1,'IVA','NOR','AO',14,
  NULL,NULL,NULL,'2019-10-01',
  'Taxa geral de IVA em Angola: 14%',
  'https://portaldocontribuinte.minfin.gov.ao/impostos-e-taxas/imposto-sobre-valor-acrescentado',
  '{"scope":"general"}'::jsonb
)
ON CONFLICT (code,version) DO NOTHING;

ALTER TABLE public.fiscal_documento_itens
  ADD COLUMN IF NOT EXISTS tax_profile_code text NULL,
  ADD COLUMN IF NOT EXISTS tax_type text NULL,
  ADD COLUMN IF NOT EXISTS tax_code text NULL,
  ADD COLUMN IF NOT EXISTS tax_country_region text NULL,
  ADD COLUMN IF NOT EXISTS operation_type text NULL,
  ADD COLUMN IF NOT EXISTS unit_of_measure text NULL,
  ADD COLUMN IF NOT EXISTS product_type text NULL,
  ADD COLUMN IF NOT EXISTS unit_price_base numeric(18,4) NULL,
  ADD COLUMN IF NOT EXISTS settlement_amount numeric(18,4) NULL,
  ADD COLUMN IF NOT EXISTS total_liquido_moeda numeric(18,4) NULL,
  ADD COLUMN IF NOT EXISTS total_impostos_moeda numeric(18,4) NULL,
  ADD COLUMN IF NOT EXISTS total_bruto_moeda numeric(18,4) NULL;

ALTER TABLE public.fiscal_documento_itens
  DISABLE TRIGGER trg_fiscal_documento_itens_no_mutation;

UPDATE public.fiscal_documento_itens
SET
  tax_profile_code = CASE
    WHEN taxa_iva = 0 AND tax_exemption_code = 'M21' THEN 'IVA_EDUCACAO_M21'
    WHEN taxa_iva = 14 THEN 'IVA_NORMAL_14_AO'
    ELSE tax_profile_code
  END,
  tax_type = COALESCE(tax_type,'IVA'),
  tax_code = COALESCE(
    tax_code,
    CASE
      WHEN taxa_iva = 0 THEN 'ISE'
      WHEN taxa_iva = 14 THEN 'NOR'
      ELSE NULL
    END
  ),
  tax_country_region = COALESCE(tax_country_region,'AO'),
  unit_of_measure = COALESCE(unit_of_measure,'UN'),
  product_type = COALESCE(product_type,'S'),
  unit_price_base = COALESCE(unit_price_base,preco_unit),
  settlement_amount = COALESCE(settlement_amount,0),
  total_liquido_moeda = COALESCE(total_liquido_moeda,total_liquido_aoa),
  total_impostos_moeda = COALESCE(total_impostos_moeda,total_impostos_aoa),
  total_bruto_moeda = COALESCE(total_bruto_moeda,total_bruto_aoa);

ALTER TABLE public.fiscal_documento_itens
  ENABLE TRIGGER trg_fiscal_documento_itens_no_mutation;

ALTER TABLE public.fiscal_documento_itens
  ADD CONSTRAINT fiscal_documento_itens_tax_semantics_chk
  CHECK (
    (tax_type IS NULL OR tax_type IN ('IVA','IS','IEC','CEOC','NS'))
    AND (tax_code IS NULL OR tax_code IN ('NOR','INT','RED','ISE','OUT','NS','NA'))
    AND (tax_country_region IS NULL OR tax_country_region ~ '^(?:[A-Z]{2}|AO-CAB)$')
    AND (operation_type IS NULL OR operation_type IN ('SE','SS','STP','SR','SIF','SHS','ST','SG','TB','AS','QT','RD'))
    AND (product_type IS NULL OR product_type IN ('P','S','O','E','I'))
    AND COALESCE(unit_price_base,0) >= 0
    AND COALESCE(settlement_amount,0) >= 0
    AND COALESCE(total_liquido_moeda,0) >= 0
    AND COALESCE(total_impostos_moeda,0) >= 0
    AND COALESCE(total_bruto_moeda,0) >= 0
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.fiscal_tax_ceil_cent(p_value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'pg_catalog'
AS $fn$
  SELECT ceil(p_value * 100) / 100;
$fn$;

CREATE OR REPLACE FUNCTION public.fiscal_tax_trunc_cent(p_value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'pg_catalog'
AS $fn$
  SELECT trunc(p_value * 100) / 100;
$fn$;

REVOKE EXECUTE ON FUNCTION public.fiscal_tax_ceil_cent(numeric)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fiscal_tax_trunc_cent(numeric)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;