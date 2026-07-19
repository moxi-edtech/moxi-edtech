-- Administrative SECURITY DEFINER functions must never be callable anonymously.
REVOKE EXECUTE ON FUNCTION public.admin_get_escola_health_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_storage_usage(integer, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_system_health() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles(text[], integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_profiles_by_ids(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_recalc_all_aggregates() FROM PUBLIC, anon;
