-- Corrige o schema usado pela funcao de refresh da MV de matriculas.
-- A materialized view existe em internal.mv_secretaria_matriculas_status,
-- enquanto a funcao anterior tentava atualizar public.mv_secretaria_matriculas_status.

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_matriculas_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_matriculas_status;
END;
$$;
