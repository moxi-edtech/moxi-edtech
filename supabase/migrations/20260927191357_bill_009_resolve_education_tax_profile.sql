CREATE OR REPLACE FUNCTION public.fiscal_resolve_education_tax_profile(
  p_empresa_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_status text;
BEGIN
  SELECT education_vat_exemption_status
  INTO v_status
  FROM public.fiscal_empresas
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH: empresa fiscal indisponível para o utilizador';
  END IF;

  IF v_status = 'eligible' THEN
    RETURN 'IVA_EDUCACAO_M21';
  END IF;

  IF v_status = 'not_eligible' THEN
    RETURN 'IVA_NORMAL_14_AO';
  END IF;

  RAISE EXCEPTION
    'STATE: enquadramento IVA do ensino não verificado para a empresa fiscal';
END;
$fn$;

REVOKE ALL ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
TO authenticated;
