BEGIN;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command IN (
      'select public.refresh_all_materialized_views()',
      'SELECT public.cleanup_pautas_zip();'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

CREATE TEMP TABLE cron_reschedule (
  command text PRIMARY KEY,
  schedule text NOT NULL
) ON COMMIT DROP;

INSERT INTO cron_reschedule (command, schedule) VALUES
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard', '0-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_missing_pricing_count', '1-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_escola_dia', '2-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_info', '3-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_cursos_stats', '4-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_escola_metrics', '5-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_margem_por_edicao', '6-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_fluxo_mensal', '7-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_relatorio_financeiro_escolar_inadimplencia_classe', '8-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_admissoes_counts_por_status', '9-59/10 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_cohorts_lotacao', '2-59/5 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje', '1-59/15 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_inadimplencia_resumo', '8-59/15 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula', '12-59/20 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes', '0,30 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status', '2,32 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_mensal_escola', '4,34 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_freq_por_turma_dia', '6,36 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_por_turma', '8,38 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media', '10,40 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top', '12,42 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_alunos_resumo', '14,44 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias', '16,46 * * * *'),
  ('REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics', '18 * * * *');

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT j.jobid, j.jobname, j.command, r.schedule
    FROM cron.job j
    JOIN cron_reschedule r ON r.command = j.command
    WHERE j.schedule IS DISTINCT FROM r.schedule
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
    PERFORM cron.schedule(v_job.jobname, v_job.schedule, v_job.command);
  END LOOP;
END;
$$;

COMMIT;
