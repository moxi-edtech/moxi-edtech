BEGIN;

DROP FUNCTION IF EXISTS public.refresh_mv_admin_pending_turmas_count();
DROP FUNCTION IF EXISTS public.refresh_mv_admissoes_counts_por_status();
DROP FUNCTION IF EXISTS public.refresh_mv_cursos_reais();
DROP FUNCTION IF EXISTS public.refresh_mv_escola_estrutura_counts();
DROP FUNCTION IF EXISTS public.refresh_mv_escola_setup_status();
DROP FUNCTION IF EXISTS public.refresh_mv_financeiro_cobrancas_diario();
DROP FUNCTION IF EXISTS public.refresh_mv_financeiro_kpis_geral();
DROP FUNCTION IF EXISTS public.refresh_mv_financeiro_radar_resumo();
DROP FUNCTION IF EXISTS public.refresh_mv_migracao_cursos_lookup();
DROP FUNCTION IF EXISTS public.refresh_mv_migracao_turmas_lookup();
DROP FUNCTION IF EXISTS public.refresh_mv_ocupacao_turmas();
DROP FUNCTION IF EXISTS public.refresh_mv_secretaria_dashboard_kpis();
DROP FUNCTION IF EXISTS public.refresh_mv_secretaria_matriculas_turma_status();
DROP FUNCTION IF EXISTS public.refresh_mv_staging_alunos_summary();
DROP FUNCTION IF EXISTS public.refresh_mv_total_em_aberto_por_mes();

COMMIT;
