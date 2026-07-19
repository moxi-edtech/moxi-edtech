-- The generic helper accepts caller-controlled scopes and keys. Keep direct
-- execution server-side; public business RPCs may still invoke it as owner.
REVOKE ALL ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(text, text, integer, integer, integer)
TO service_role;
