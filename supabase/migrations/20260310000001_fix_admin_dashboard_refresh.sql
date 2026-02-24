BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_mv_admin_dashboard_counts() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admin_dashboard_counts;
END;
$$;

ALTER FUNCTION public.refresh_mv_admin_dashboard_counts() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.refresh_mv_admin_dashboard_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_admin_dashboard_counts() TO service_role;

COMMIT;
