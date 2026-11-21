-- Run after 20271130090000_consolidate_pg_cron_io_free_tier.sql.
-- Read-only regression: canonical data refresh must stay scheduled.
DO $verify$
DECLARE
  v_mismatch text;
BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname='refresh_mv_pagamentos_status'
      AND active AND btrim(command)='SELECT public.refresh_mv_pagamentos_status();') <> 1 THEN
    RAISE EXCEPTION 'IO regression: expected one active canonical payment refresh';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job
             WHERE active AND jobname='fin-pagamentos-status-5m') THEN
    RAISE EXCEPTION 'IO regression: redundant payment refresh still active';
  END IF;

  SELECT string_agg(jobname, ', ') INTO v_mismatch
  FROM cron.job
  WHERE active AND jobname='refresh-audit-metrics-daily'
    AND schedule='18 * * * *';
  IF v_mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'IO regression: audit summary still refreshing hourly';
  END IF;

  -- Existing installations with the supported read models must keep their
  -- reduced cadence (fresh installs should not revive aggressive schedules).
  SELECT string_agg(j.jobname, ', ' ORDER BY j.jobname) INTO v_mismatch
  FROM (
    VALUES
      ('refresh_mv_escola_info', '3 * * * *'),
      ('refresh_mv_escola_cursos_stats', '4 * * * *'),
      ('refresh_mv_super_admin_escola_metrics', '5 * * * *'),
      ('refresh_mv_top_turmas_hoje', '11 * * * *'),
      ('fin-sidebar-5m', '1,31 * * * *'),
      ('fin-dashboard-5m', '0,30 * * * *'),
      ('refresh-boletim-hourly', '12 * * * *'),
      ('refresh_mv_formacao_inadimplencia_resumo', '17 * * * *'),
      ('refresh-mv-risco-pedagogico-aluno', '16 * * * *'),
      ('refresh_mv_operacoes_dashboard_work', '2,32 * * * *'),
      ('refresh-mv-financeiro-carteira-alunos', '8,38 * * * *'),
      ('refresh_mv_radar_inadimplencia', '33 * * * *'),
      ('refresh_financeiro_read_models_ano', '7,37 * * * *')
  ) AS expected(jobname, target_schedule)
  JOIN cron.job j ON j.jobname = expected.jobname AND j.active
  WHERE j.schedule IS DISTINCT FROM expected.target_schedule;
  IF v_mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'IO regression: reverted cron schedules: %', v_mismatch;
  END IF;

  -- Transactional workers must never be disabled by cost optimizations.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE active AND jobname='outbox-db-worker-1m') OR
     NOT EXISTS (SELECT 1 FROM cron.job WHERE active AND jobname='operational-receipts-1m') THEN
    RAISE EXCEPTION 'IO regression: critical outbox/receipt worker disabled';
  END IF;
END;
$verify$;
