-- The aggregate recalculation is now executed exclusively by the registered
-- Inngest worker with SUPABASE_SERVICE_ROLE_KEY.
REVOKE EXECUTE ON FUNCTION public.admin_recalc_all_aggregates()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_recalc_all_aggregates()
TO service_role;
