BEGIN;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_boletim_por_matricula()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_mv_boletim_por_matricula()
TO service_role;

COMMIT;
