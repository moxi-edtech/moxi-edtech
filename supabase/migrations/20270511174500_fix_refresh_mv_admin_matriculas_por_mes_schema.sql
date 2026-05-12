CREATE OR REPLACE FUNCTION public.refresh_mv_admin_matriculas_por_mes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admin_matriculas_por_mes;
END;
$$;
