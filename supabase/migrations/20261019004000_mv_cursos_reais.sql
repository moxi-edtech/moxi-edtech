CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DROP VIEW IF EXISTS public.vw_cursos_reais;
DROP MATERIALIZED VIEW IF EXISTS public.mv_cursos_reais;

CREATE MATERIALIZED VIEW public.mv_cursos_reais AS
SELECT
  c.id,
  c.escola_id,
  c.codigo,
  c.nome,
  c.tipo,
  c.descricao,
  c.nivel,
  c.semestre_id,
  c.course_code,
  c.curriculum_key,
  c.status_aprovacao
FROM public.cursos c
WHERE c.status_aprovacao = 'aprovado'
  AND EXISTS (
    SELECT 1
    FROM public.curso_matriz cm
    WHERE cm.curso_id = c.id
      AND (cm.ativo IS NULL OR cm.ativo = true)
  )
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_cursos_reais
  ON public.mv_cursos_reais (escola_id, id);

CREATE OR REPLACE FUNCTION public.refresh_mv_cursos_reais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cursos_reais;
END;
$$;

CREATE OR REPLACE VIEW public.vw_cursos_reais AS
SELECT *
FROM public.mv_cursos_reais
WHERE escola_id = public.current_tenant_escola_id();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_cursos_reais') THEN
    PERFORM cron.schedule('refresh_mv_cursos_reais', '*/10 * * * *', 'SELECT public.refresh_mv_cursos_reais();');
  END IF;
END $$;
