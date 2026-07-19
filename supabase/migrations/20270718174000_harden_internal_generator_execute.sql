BEGIN;

REVOKE EXECUTE ON FUNCTION public.generate_activation_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_admissao_public_protocol(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_activation_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_admissao_public_protocol(uuid, integer) TO service_role;

COMMIT;
