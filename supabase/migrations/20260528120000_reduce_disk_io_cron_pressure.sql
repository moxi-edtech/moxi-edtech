BEGIN;

-- Remove orphan pg_cron jobs that refresh non-existent public MVs.
DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command IN (
      'SELECT public.refresh_mv_admin_pending_turmas_count();',
      'select public.refresh_mv_admissoes_counts_por_status();',
      'SELECT public.refresh_mv_cursos_reais();',
      'select public.refresh_mv_escola_estrutura_counts();',
      'select public.refresh_mv_escola_setup_status();',
      'select public.refresh_mv_financeiro_cobrancas_diario();',
      'select public.refresh_mv_financeiro_kpis_geral();',
      'select public.refresh_mv_financeiro_radar_resumo();',
      'SELECT public.refresh_mv_migracao_cursos_lookup();',
      'SELECT public.refresh_mv_migracao_turmas_lookup();',
      'select public.refresh_mv_ocupacao_turmas();',
      'select public.refresh_mv_secretaria_dashboard_kpis();',
      'SELECT public.refresh_mv_secretaria_matriculas_turma_status();',
      'SELECT public.refresh_mv_staging_alunos_summary();',
      'select public.refresh_mv_total_em_aberto_por_mes();'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

-- Reschedule high-frequency refreshes to lower sustained disk IO and WAL churn.
DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command IN (
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_mensal_escola',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_freq_por_turma_dia',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_por_turma',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_alunos_resumo',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_inadimplencia_resumo'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_kpis_mes',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes$$
);

SELECT cron.schedule(
  'refresh_mv_pagamentos_status',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status$$
);

SELECT cron.schedule(
  'refresh_mv_financeiro_propinas_mensal_escola',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_mensal_escola$$
);

SELECT cron.schedule(
  'refresh_mv_freq_por_turma_dia',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_freq_por_turma_dia$$
);

SELECT cron.schedule(
  'refresh_mv_financeiro_propinas_por_turma',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_por_turma$$
);

SELECT cron.schedule(
  'refresh_mv_top_turmas_hoje',
  '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje$$
);

SELECT cron.schedule(
  'refresh_mv_top_cursos_media',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media$$
);

SELECT cron.schedule(
  'refresh_mv_super_admin_audit_metrics',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics$$
);

SELECT cron.schedule(
  'refresh_mv_financeiro_inadimplencia_top',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top$$
);

SELECT cron.schedule(
  'refresh_mv_secretaria_alunos_resumo',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_alunos_resumo$$
);

SELECT cron.schedule(
  'refresh_mv_professor_pendencias',
  '*/30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_professor_pendencias$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_inadimplencia_resumo',
  '*/15 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_formacao_inadimplencia_resumo$$
);

COMMIT;
