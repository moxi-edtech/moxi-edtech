BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_school_operational_readiness(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_setup_state(uuid, integer) FROM anon;

COMMIT;
