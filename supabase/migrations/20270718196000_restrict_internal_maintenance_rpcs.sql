BEGIN;

-- Executed by pg_cron as the database owner, never by an end-user client.
REVOKE EXECUTE ON FUNCTION public.admissao_auto_expire_reservations()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admissao_auto_expire_reservations()
TO service_role;

-- Executed only by the pautas Inngest worker with SUPABASE_SERVICE_ROLE_KEY.
-- A later broad pedagogical grant accidentally restored authenticated access.
REVOKE EXECUTE ON FUNCTION public.increment_pautas_lote_job(uuid, boolean, boolean)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_pautas_lote_job(uuid, boolean, boolean)
TO service_role;

COMMIT;
