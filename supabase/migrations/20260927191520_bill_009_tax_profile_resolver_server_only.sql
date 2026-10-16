REVOKE EXECUTE ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.fiscal_resolve_education_tax_profile(uuid)
TO service_role;
