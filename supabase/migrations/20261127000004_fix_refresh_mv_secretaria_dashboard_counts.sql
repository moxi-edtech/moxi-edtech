BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_dashboard_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_dashboard_counts;
END;
$$;

COMMIT;
