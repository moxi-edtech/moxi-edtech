-- KLASSE production incident: Supabase disk-I/O budget depletion, 2026-11-19.
-- This is an audited, MANUAL incident runbook. It is NOT a deployment migration.
-- 13 jobs were changed directly in production after inspecting cron.job and pg_stat_statements.
-- Transactional jobs (outbox-db-worker-1m, operational-receipts-1m and reconciliation)
-- deliberately remain unchanged.
-- Data / payment writes are not modified. Dashboard/materialized-view freshness
-- is temporarily lowered to 30-60 minutes while the database recovers.
--
-- Preconditions: privileged operator; inspect cron.job; read the original schedules
-- below, and do not overwrite newer scheduling decisions.
--
-- Emergency apply / idempotent reapply:
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT j.jobid, j.jobname, j.schedule AS current_schedule,
           x.old_schedule, x.relief_schedule
    FROM (VALUES
  ('refresh_mv_escola_info', '3-59/10 * * * *', '3 * * * *'),
  ('refresh_mv_escola_cursos_stats', '4-59/10 * * * *', '4 * * * *'),
  ('refresh_mv_super_admin_escola_metrics', '5-59/10 * * * *', '5 * * * *'),
  ('refresh_mv_top_turmas_hoje', '1-59/15 * * * *', '11 * * * *'),
  ('fin-sidebar-5m', '1-59/5 * * * *', '1,31 * * * *'),
  ('fin-dashboard-5m', '0-59/10 * * * *', '0,30 * * * *'),
  ('refresh-boletim-hourly', '12-59/20 * * * *', '12 * * * *'),
  ('refresh_mv_formacao_inadimplencia_resumo', '17,47 * * * *', '17 * * * *'),
  ('refresh-mv-risco-pedagogico-aluno', '*/15 * * * *', '16 * * * *'),
  ('refresh_mv_operacoes_dashboard_work', '2-59/5 * * * *', '2,32 * * * *'),
  ('refresh-mv-financeiro-carteira-alunos', '*/5 * * * *', '8,38 * * * *'),
  ('refresh_mv_radar_inadimplencia', '3,33 * * * *', '33 * * * *'),
  ('refresh_financeiro_read_models_ano', '*/10 * * * *', '7,37 * * * *')
    ) AS x(jobname, old_schedule, relief_schedule)
    JOIN cron.job j USING (jobname)
    WHERE j.active
  LOOP
    IF v.current_schedule = v.old_schedule THEN
      PERFORM cron.alter_job(v.jobid, schedule := v.relief_schedule);
    ELSIF v.current_schedule <> v.relief_schedule THEN
      RAISE WARNING 'Skipping %, unexpected schedule: %', v.jobname, v.current_schedule;
    END IF;
  END LOOP;
END $$;

-- Verification:
WITH expected (jobname, old_schedule, relief_schedule) AS (VALUES
  ('refresh_mv_escola_info', '3-59/10 * * * *', '3 * * * *'),
  ('refresh_mv_escola_cursos_stats', '4-59/10 * * * *', '4 * * * *'),
  ('refresh_mv_super_admin_escola_metrics', '5-59/10 * * * *', '5 * * * *'),
  ('refresh_mv_top_turmas_hoje', '1-59/15 * * * *', '11 * * * *'),
  ('fin-sidebar-5m', '1-59/5 * * * *', '1,31 * * * *'),
  ('fin-dashboard-5m', '0-59/10 * * * *', '0,30 * * * *'),
  ('refresh-boletim-hourly', '12-59/20 * * * *', '12 * * * *'),
  ('refresh_mv_formacao_inadimplencia_resumo', '17,47 * * * *', '17 * * * *'),
  ('refresh-mv-risco-pedagogico-aluno', '*/15 * * * *', '16 * * * *'),
  ('refresh_mv_operacoes_dashboard_work', '2-59/5 * * * *', '2,32 * * * *'),
  ('refresh-mv-financeiro-carteira-alunos', '*/5 * * * *', '8,38 * * * *'),
  ('refresh_mv_radar_inadimplencia', '3,33 * * * *', '33 * * * *'),
  ('refresh_financeiro_read_models_ano', '*/10 * * * *', '7,37 * * * *')
)
SELECT e.jobname, j.active, j.schedule AS current_schedule,
       e.relief_schedule, j.schedule = e.relief_schedule AS applied
FROM expected e LEFT JOIN cron.job j USING (jobname)
ORDER BY e.jobname;

-- ROLLBACK (only after the incident, and only after approving restored load):
-- Copy the DO block above, reverse the old_schedule/relief_schedule roles
-- and update only when the current schedule equals relief_schedule.
-- Do not restore all 13 jobs simultaneously without confirming IO headroom.
--
-- IMPORTANT: pg_stat_statements metrics are cumulative; assess relief by
-- comparing deltas (I/O bytes, WAL bytes, errors, latency) across equal windows.
-- No reset of production counters; no VACUUM FULL during saturation.
