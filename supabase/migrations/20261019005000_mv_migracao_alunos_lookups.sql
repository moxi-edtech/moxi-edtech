CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- =============================================================================
-- Staging summary (migracao preview)
-- =============================================================================

DROP VIEW IF EXISTS public.vw_staging_alunos_summary;
DROP MATERIALIZED VIEW IF EXISTS public.mv_staging_alunos_summary;

CREATE MATERIALIZED VIEW public.mv_staging_alunos_summary AS
SELECT
  sa.escola_id,
  sa.import_id,
  sa.turma_codigo,
  sa.ano_letivo,
  COUNT(sa.id)::bigint AS total_alunos
FROM public.staging_alunos sa
WHERE sa.turma_codigo IS NOT NULL
GROUP BY sa.escola_id, sa.import_id, sa.turma_codigo, sa.ano_letivo
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_staging_alunos_summary
  ON public.mv_staging_alunos_summary (escola_id, import_id, turma_codigo, ano_letivo);

CREATE OR REPLACE FUNCTION public.refresh_mv_staging_alunos_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_staging_alunos_summary;
END;
$$;

CREATE OR REPLACE VIEW public.vw_staging_alunos_summary AS
SELECT *
FROM public.mv_staging_alunos_summary
WHERE escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- Cursos lookup (migracao backfill)
-- =============================================================================

DROP VIEW IF EXISTS public.vw_migracao_cursos_lookup;
DROP MATERIALIZED VIEW IF EXISTS public.mv_migracao_cursos_lookup;

CREATE MATERIALIZED VIEW public.mv_migracao_cursos_lookup AS
SELECT
  c.id,
  c.escola_id,
  c.codigo,
  c.course_code,
  c.status_aprovacao
FROM public.cursos c
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_migracao_cursos_lookup
  ON public.mv_migracao_cursos_lookup (escola_id, id);

CREATE OR REPLACE FUNCTION public.refresh_mv_migracao_cursos_lookup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_migracao_cursos_lookup;
END;
$$;

CREATE OR REPLACE VIEW public.vw_migracao_cursos_lookup AS
SELECT *
FROM public.mv_migracao_cursos_lookup
WHERE escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- Turmas lookup (migracao preview)
-- =============================================================================

DROP VIEW IF EXISTS public.vw_migracao_turmas_lookup;
DROP MATERIALIZED VIEW IF EXISTS public.mv_migracao_turmas_lookup;

CREATE MATERIALIZED VIEW public.mv_migracao_turmas_lookup AS
SELECT
  t.id,
  t.escola_id,
  t.turma_code,
  t.ano_letivo,
  t.nome
FROM public.turmas t
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_migracao_turmas_lookup
  ON public.mv_migracao_turmas_lookup (escola_id, turma_code, ano_letivo);

CREATE OR REPLACE FUNCTION public.refresh_mv_migracao_turmas_lookup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_migracao_turmas_lookup;
END;
$$;

CREATE OR REPLACE VIEW public.vw_migracao_turmas_lookup AS
SELECT *
FROM public.mv_migracao_turmas_lookup
WHERE escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- Jobs (pg_cron)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_staging_alunos_summary') THEN
    PERFORM cron.schedule('refresh_mv_staging_alunos_summary', '*/10 * * * *', 'SELECT public.refresh_mv_staging_alunos_summary();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_migracao_cursos_lookup') THEN
    PERFORM cron.schedule('refresh_mv_migracao_cursos_lookup', '*/10 * * * *', 'SELECT public.refresh_mv_migracao_cursos_lookup();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_migracao_turmas_lookup') THEN
    PERFORM cron.schedule('refresh_mv_migracao_turmas_lookup', '*/10 * * * *', 'SELECT public.refresh_mv_migracao_turmas_lookup();');
  END IF;
END $$;
