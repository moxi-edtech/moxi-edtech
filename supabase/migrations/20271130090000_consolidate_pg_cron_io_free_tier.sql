-- KLASSE free-tier I/O relief. Do not move transactional outbox workers here.
-- Pg_cron schedules are deliberately reversible and no materialized view is dropped.
-- Keep the canonical required refresh_mv_pagamentos_status job (AGENTS.md / F18).
BEGIN;

DO $migrate$
DECLARE
  v_job record;
BEGIN
  -- Never suppress the extra refresh unless the canonical refresh is available.
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'refresh_mv_pagamentos_status'
      AND active
      AND btrim(command) = 'SELECT public.refresh_mv_pagamentos_status();'
  ) THEN
    RAISE EXCEPTION 'KLASSE_IO: canonical pagamentos status refresh missing or changed';
  END IF;

  -- This legacy job performs the same MV refresh as the canonical wrapper.
  -- Disable, rather than unschedule, for a one-command rollback.
  FOR v_job IN
    SELECT jobid, command FROM cron.job
    WHERE jobname = 'fin-pagamentos-status-5m' AND active
  LOOP
    IF btrim(v_job.command) <> 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status' THEN
      RAISE EXCEPTION 'KLASSE_IO: unexpected legacy payment refresh command for job %', v_job.jobid;
    END IF;
    PERFORM cron.alter_job(v_job.jobid, active := false);
  END LOOP;

  -- Preserve the tested emergency relief for fresh installations. Existing
  -- schedules are only changed if their commands still match the known jobs.
  FOR v_job IN
    SELECT j.jobid, j.jobname, j.command, j.schedule,
           conf.expected_command, conf.target_schedule
    FROM (
      VALUES
        ('refresh_mv_escola_info', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_info', '3 * * * *'),
        ('refresh_mv_escola_cursos_stats', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_cursos_stats', '4 * * * *'),
        ('refresh_mv_super_admin_escola_metrics', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_escola_metrics', '5 * * * *'),
        ('refresh_mv_top_turmas_hoje', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje', '11 * * * *'),
        ('fin-sidebar-5m', 'select public.refresh_mv_financeiro_sidebar_badges();', '1,31 * * * *'),
        ('fin-dashboard-5m', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard', '0,30 * * * *'),
        ('refresh-boletim-hourly', 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula', '12 * * * *'),
        ('refresh_mv_formacao_inadimplencia_resumo', 'SELECT public.refresh_mv_formacao_inadimplencia_resumo();', '17 * * * *'),
        ('refresh-mv-risco-pedagogico-aluno', 'SELECT public.refresh_mv_risco_pedagogico_aluno();', '16 * * * *'),
        ('refresh_mv_operacoes_dashboard_work', 'SELECT public.refresh_mv_operacoes_dashboard_work();', '2,32 * * * *'),
        ('refresh-mv-financeiro-carteira-alunos', 'SELECT public.refresh_mv_financeiro_carteira_alunos();', '8,38 * * * *'),
        ('refresh_mv_radar_inadimplencia', 'SELECT public.refresh_mv_radar_inadimplencia();', '33 * * * *'),
        ('refresh_financeiro_read_models_ano', 'SELECT public.refresh_financeiro_read_models_ano()', '7,37 * * * *')
    ) AS conf(jobname, expected_command, target_schedule)
    JOIN cron.job j ON j.jobname = conf.jobname AND j.active
  LOOP
    IF btrim(v_job.command) <> v_job.expected_command THEN
      RAISE EXCEPTION 'KLASSE_IO: unexpected command for job %', v_job.jobname;
    END IF;
    IF v_job.schedule IS DISTINCT FROM v_job.target_schedule THEN
      PERFORM cron.alter_job(v_job.jobid, schedule := v_job.target_schedule);
    END IF;
  END LOOP;

  -- Super-admin audit summary can be up to six hours old; raw audit events
  -- remain in their source table. Was hourly despite the "-daily" job name.
  FOR v_job IN
    SELECT jobid, command, schedule FROM cron.job
    WHERE jobname = 'refresh-audit-metrics-daily' AND active
  LOOP
    IF btrim(v_job.command) <> 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics' THEN
      RAISE EXCEPTION 'KLASSE_IO: unexpected audit metrics command';
    END IF;
    IF v_job.schedule = '18 * * * *' THEN
      PERFORM cron.alter_job(v_job.jobid, schedule := '18 */6 * * *');
    END IF;
  END LOOP;
END;
$migrate$;

COMMIT;
