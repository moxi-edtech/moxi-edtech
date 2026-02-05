CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_kpis_mes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_kpis_mes',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes$$
);
