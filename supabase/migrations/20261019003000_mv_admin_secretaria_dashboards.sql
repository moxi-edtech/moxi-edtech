CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- =============================================================================
-- Secretaria dashboard aggregates
-- =============================================================================

DROP VIEW IF EXISTS public.vw_secretaria_dashboard_counts;
DROP MATERIALIZED VIEW IF EXISTS public.mv_secretaria_dashboard_counts;

CREATE MATERIALIZED VIEW public.mv_secretaria_dashboard_counts AS
SELECT
  e.id AS escola_id,
  COALESCE(alunos_ativos.alunos_ativos, 0)::integer AS alunos_ativos,
  COALESCE(matriculas_total.matriculas_total, 0)::integer AS matriculas_total,
  COALESCE(turmas_total.turmas_total, 0)::integer AS turmas_total
FROM public.escolas e
LEFT JOIN (
  SELECT escola_id, COUNT(DISTINCT aluno_id) AS alunos_ativos
  FROM public.matriculas
  WHERE status IN ('ativa', 'ativo', 'active')
  GROUP BY escola_id
) alunos_ativos ON alunos_ativos.escola_id = e.id
LEFT JOIN (
  SELECT escola_id, COUNT(*) AS matriculas_total
  FROM public.matriculas
  GROUP BY escola_id
) matriculas_total ON matriculas_total.escola_id = e.id
LEFT JOIN (
  SELECT escola_id, COUNT(*) AS turmas_total
  FROM public.turmas
  GROUP BY escola_id
) turmas_total ON turmas_total.escola_id = e.id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_secretaria_dashboard_counts
  ON public.mv_secretaria_dashboard_counts (escola_id);

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_dashboard_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_dashboard_counts;
END;
$$;

CREATE OR REPLACE VIEW public.vw_secretaria_dashboard_counts AS
SELECT *
FROM public.mv_secretaria_dashboard_counts
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_secretaria_matriculas_status;
DROP MATERIALIZED VIEW IF EXISTS public.mv_secretaria_matriculas_status;

CREATE MATERIALIZED VIEW public.mv_secretaria_matriculas_status AS
SELECT
  escola_id,
  LOWER(COALESCE(status, 'indefinido')) AS status,
  COUNT(*)::integer AS total
FROM public.matriculas
GROUP BY escola_id, LOWER(COALESCE(status, 'indefinido'))
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_secretaria_matriculas_status
  ON public.mv_secretaria_matriculas_status (escola_id, status);

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_matriculas_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_matriculas_status;
END;
$$;

CREATE OR REPLACE VIEW public.vw_secretaria_matriculas_status AS
SELECT *
FROM public.mv_secretaria_matriculas_status
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_secretaria_matriculas_turma_status;
DROP MATERIALIZED VIEW IF EXISTS public.mv_secretaria_matriculas_turma_status;

CREATE MATERIALIZED VIEW public.mv_secretaria_matriculas_turma_status AS
SELECT
  escola_id,
  turma_id,
  LOWER(COALESCE(status, 'indefinido')) AS status,
  COUNT(*)::integer AS total
FROM public.matriculas
GROUP BY escola_id, turma_id, LOWER(COALESCE(status, 'indefinido'))
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_secretaria_matriculas_turma_status
  ON public.mv_secretaria_matriculas_turma_status (escola_id, turma_id, status);

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_matriculas_turma_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_secretaria_matriculas_turma_status;
END;
$$;

CREATE OR REPLACE VIEW public.vw_secretaria_matriculas_turma_status AS
SELECT *
FROM public.mv_secretaria_matriculas_turma_status
WHERE escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- Admin dashboard aggregates
-- =============================================================================

DROP VIEW IF EXISTS public.vw_admin_dashboard_counts;
DROP MATERIALIZED VIEW IF EXISTS public.mv_admin_dashboard_counts;

CREATE MATERIALIZED VIEW public.mv_admin_dashboard_counts AS
SELECT
  e.id AS escola_id,
  COALESCE(alunos_ativos.alunos_ativos, 0)::integer AS alunos_ativos,
  COALESCE(turmas_total.turmas_total, 0)::integer AS turmas_total,
  COALESCE(professores_total.professores_total, 0)::integer AS professores_total,
  COALESCE(avaliacoes_total.avaliacoes_total, 0)::integer AS avaliacoes_total
FROM public.escolas e
LEFT JOIN (
  SELECT escola_id, COUNT(DISTINCT aluno_id) AS alunos_ativos
  FROM public.matriculas
  WHERE status IN ('ativa', 'ativo', 'active')
  GROUP BY escola_id
) alunos_ativos ON alunos_ativos.escola_id = e.id
LEFT JOIN (
  SELECT escola_id, COUNT(*) AS turmas_total
  FROM public.turmas
  GROUP BY escola_id
) turmas_total ON turmas_total.escola_id = e.id
LEFT JOIN (
  SELECT escola_id, COUNT(*) AS professores_total
  FROM public.escola_users
  WHERE papel = 'professor'
  GROUP BY escola_id
) professores_total ON professores_total.escola_id = e.id
LEFT JOIN (
  SELECT m.escola_id, COUNT(n.id) AS avaliacoes_total
  FROM public.notas n
  JOIN public.matriculas m ON m.id = n.matricula_id
  GROUP BY m.escola_id
) avaliacoes_total ON avaliacoes_total.escola_id = e.id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_admin_dashboard_counts
  ON public.mv_admin_dashboard_counts (escola_id);

CREATE OR REPLACE FUNCTION public.refresh_mv_admin_dashboard_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_admin_dashboard_counts;
END;
$$;

CREATE OR REPLACE VIEW public.vw_admin_dashboard_counts AS
SELECT *
FROM public.mv_admin_dashboard_counts
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_admin_matriculas_por_mes;
DROP MATERIALIZED VIEW IF EXISTS public.mv_admin_matriculas_por_mes;

CREATE MATERIALIZED VIEW public.mv_admin_matriculas_por_mes AS
SELECT
  escola_id,
  DATE_TRUNC('month', COALESCE(data_matricula, created_at))::date AS mes,
  COUNT(*)::integer AS total
FROM public.matriculas
WHERE COALESCE(data_matricula, created_at) >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
GROUP BY escola_id, DATE_TRUNC('month', COALESCE(data_matricula, created_at))
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_admin_matriculas_por_mes
  ON public.mv_admin_matriculas_por_mes (escola_id, mes);

CREATE OR REPLACE FUNCTION public.refresh_mv_admin_matriculas_por_mes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_admin_matriculas_por_mes;
END;
$$;

CREATE OR REPLACE VIEW public.vw_admin_matriculas_por_mes AS
SELECT *
FROM public.mv_admin_matriculas_por_mes
WHERE escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- Jobs (pg_cron)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_radar_inadimplencia') THEN
    PERFORM cron.schedule('refresh_mv_radar_inadimplencia', '*/10 * * * *', 'SELECT public.refresh_mv_radar_inadimplencia();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_pagamentos_status') THEN
    PERFORM cron.schedule('refresh_mv_pagamentos_status', '*/10 * * * *', 'SELECT public.refresh_mv_pagamentos_status();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_secretaria_dashboard_counts') THEN
    PERFORM cron.schedule('refresh_mv_secretaria_dashboard_counts', '*/10 * * * *', 'SELECT public.refresh_mv_secretaria_dashboard_counts();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_secretaria_matriculas_status') THEN
    PERFORM cron.schedule('refresh_mv_secretaria_matriculas_status', '*/10 * * * *', 'SELECT public.refresh_mv_secretaria_matriculas_status();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_secretaria_matriculas_turma_status') THEN
    PERFORM cron.schedule('refresh_mv_secretaria_matriculas_turma_status', '*/10 * * * *', 'SELECT public.refresh_mv_secretaria_matriculas_turma_status();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_admin_dashboard_counts') THEN
    PERFORM cron.schedule('refresh_mv_admin_dashboard_counts', '*/10 * * * *', 'SELECT public.refresh_mv_admin_dashboard_counts();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_mv_admin_matriculas_por_mes') THEN
    PERFORM cron.schedule('refresh_mv_admin_matriculas_por_mes', '*/10 * * * *', 'SELECT public.refresh_mv_admin_matriculas_por_mes();');
  END IF;
END $$;
