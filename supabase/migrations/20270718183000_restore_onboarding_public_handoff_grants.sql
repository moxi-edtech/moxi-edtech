BEGIN;

GRANT EXECUTE ON FUNCTION public.get_school_operational_readiness(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_setup_state(uuid, integer) TO anon;

COMMIT;
