-- Restore execute permission for RLS helper current_escola_id
-- The function was revoked from PUBLIC/authenticated in 20251214120000_add_rls_policies.sql,
-- which blocks authenticated queries from evaluating policies that call it.
GRANT EXECUTE ON FUNCTION public.current_escola_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_escola_id() TO service_role;
