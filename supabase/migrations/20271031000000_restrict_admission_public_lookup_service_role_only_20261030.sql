-- KLASSE #308: the public admissions route uses service_role after rate limiting.
-- Short sequential protocols must not expose candidate PII through direct PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text)
TO service_role;