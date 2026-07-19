BEGIN;

REVOKE EXECUTE ON FUNCTION public.generate_unique_numero_login(uuid,user_role,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_escola_sigla(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_unique_numero_login(uuid,user_role,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_escola_sigla(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_escola_document_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_escola_document_branding(uuid) TO authenticated, service_role;

COMMIT;
