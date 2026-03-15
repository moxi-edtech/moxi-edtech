BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_mv_radar_inadimplencia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_radar_inadimplencia;
END;
$$;

COMMIT;
