BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_mv_turmas_para_matricula()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_turmas_para_matricula;
END;
$$;

COMMIT;
