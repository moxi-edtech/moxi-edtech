do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'refresh_mv_admin_dashboard_counts') then
      perform cron.unschedule('refresh_mv_admin_dashboard_counts');
      perform cron.schedule('refresh_mv_admin_dashboard_counts', '1-59/10 * * * *', 'SELECT public.refresh_mv_admin_dashboard_counts();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_admin_matriculas_por_mes') then
      perform cron.unschedule('refresh_mv_admin_matriculas_por_mes');
      perform cron.schedule('refresh_mv_admin_matriculas_por_mes', '4-59/10 * * * *', 'SELECT public.refresh_mv_admin_matriculas_por_mes();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_admin_pending_turmas_count') then
      perform cron.unschedule('refresh_mv_admin_pending_turmas_count');
      perform cron.schedule('refresh_mv_admin_pending_turmas_count', '5-59/10 * * * *', 'SELECT public.refresh_mv_admin_pending_turmas_count();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_admissoes_counts_por_status') then
      perform cron.unschedule('refresh_mv_admissoes_counts_por_status');
      perform cron.schedule('refresh_mv_admissoes_counts_por_status', '2-59/10 * * * *', 'select public.refresh_mv_admissoes_counts_por_status();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_cursos_reais') then
      perform cron.unschedule('refresh_mv_cursos_reais');
      perform cron.schedule('refresh_mv_cursos_reais', '1-59/10 * * * *', 'SELECT public.refresh_mv_cursos_reais();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_escola_estrutura_counts') then
      perform cron.unschedule('refresh_mv_escola_estrutura_counts');
      perform cron.schedule('refresh_mv_escola_estrutura_counts', '6-59/10 * * * *', 'select public.refresh_mv_escola_estrutura_counts();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_escola_setup_status') then
      perform cron.unschedule('refresh_mv_escola_setup_status');
      perform cron.schedule('refresh_mv_escola_setup_status', '5-59/10 * * * *', 'select public.refresh_mv_escola_setup_status();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_cobrancas_diario') then
      perform cron.unschedule('refresh_mv_financeiro_cobrancas_diario');
      perform cron.schedule('refresh_mv_financeiro_cobrancas_diario', '8-59/10 * * * *', 'select public.refresh_mv_financeiro_cobrancas_diario();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_kpis_geral') then
      perform cron.unschedule('refresh_mv_financeiro_kpis_geral');
      perform cron.schedule('refresh_mv_financeiro_kpis_geral', '0-59/10 * * * *', 'select public.refresh_mv_financeiro_kpis_geral();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_kpis_mes') then
      perform cron.unschedule('refresh_mv_financeiro_kpis_mes');
      perform cron.schedule('refresh_mv_financeiro_kpis_mes', '2-59/10 * * * *', 'select public.refresh_mv_financeiro_kpis_mes();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_radar_resumo') then
      perform cron.unschedule('refresh_mv_financeiro_radar_resumo');
      perform cron.schedule('refresh_mv_financeiro_radar_resumo', '4-59/10 * * * *', 'select public.refresh_mv_financeiro_radar_resumo();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_financeiro_sidebar_badges') then
      perform cron.unschedule('refresh_mv_financeiro_sidebar_badges');
      perform cron.schedule('refresh_mv_financeiro_sidebar_badges', '6-59/10 * * * *', 'select public.refresh_mv_financeiro_sidebar_badges();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_migracao_cursos_lookup') then
      perform cron.unschedule('refresh_mv_migracao_cursos_lookup');
      perform cron.schedule('refresh_mv_migracao_cursos_lookup', '7-59/10 * * * *', 'SELECT public.refresh_mv_migracao_cursos_lookup();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_migracao_turmas_lookup') then
      perform cron.unschedule('refresh_mv_migracao_turmas_lookup');
      perform cron.schedule('refresh_mv_migracao_turmas_lookup', '8-59/10 * * * *', 'SELECT public.refresh_mv_migracao_turmas_lookup();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_ocupacao_turmas') then
      perform cron.unschedule('refresh_mv_ocupacao_turmas');
      perform cron.schedule('refresh_mv_ocupacao_turmas', '3-59/10 * * * *', 'select public.refresh_mv_ocupacao_turmas();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_pagamentos_status') then
      perform cron.unschedule('refresh_mv_pagamentos_status');
      perform cron.schedule('refresh_mv_pagamentos_status', '7-59/10 * * * *', 'SELECT public.refresh_mv_pagamentos_status();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_radar_inadimplencia') then
      perform cron.unschedule('refresh_mv_radar_inadimplencia');
      perform cron.schedule('refresh_mv_radar_inadimplencia', '9-59/10 * * * *', 'SELECT public.refresh_mv_radar_inadimplencia();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_secretaria_dashboard_counts') then
      perform cron.unschedule('refresh_mv_secretaria_dashboard_counts');
      perform cron.schedule('refresh_mv_secretaria_dashboard_counts', '1-59/10 * * * *', 'SELECT public.refresh_mv_secretaria_dashboard_counts();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_secretaria_dashboard_kpis') then
      perform cron.unschedule('refresh_mv_secretaria_dashboard_kpis');
      perform cron.schedule('refresh_mv_secretaria_dashboard_kpis', '2-59/10 * * * *', 'select public.refresh_mv_secretaria_dashboard_kpis();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_secretaria_matriculas_status') then
      perform cron.unschedule('refresh_mv_secretaria_matriculas_status');
      perform cron.schedule('refresh_mv_secretaria_matriculas_status', '4-59/10 * * * *', 'SELECT public.refresh_mv_secretaria_matriculas_status();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_secretaria_matriculas_turma_status') then
      perform cron.unschedule('refresh_mv_secretaria_matriculas_turma_status');
      perform cron.schedule('refresh_mv_secretaria_matriculas_turma_status', '5-59/10 * * * *', 'SELECT public.refresh_mv_secretaria_matriculas_turma_status();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_staging_alunos_summary') then
      perform cron.unschedule('refresh_mv_staging_alunos_summary');
      perform cron.schedule('refresh_mv_staging_alunos_summary', '9-59/10 * * * *', 'SELECT public.refresh_mv_staging_alunos_summary();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_total_em_aberto_por_mes') then
      perform cron.unschedule('refresh_mv_total_em_aberto_por_mes');
      perform cron.schedule('refresh_mv_total_em_aberto_por_mes', '9-59/10 * * * *', 'select public.refresh_mv_total_em_aberto_por_mes();');
    end if;

    if exists (select 1 from cron.job where jobname = 'refresh_mv_turmas_para_matricula') then
      perform cron.unschedule('refresh_mv_turmas_para_matricula');
      perform cron.schedule('refresh_mv_turmas_para_matricula', '2-59/10 * * * *', 'select public.refresh_mv_turmas_para_matricula();');
    end if;
  end if;
end $$;
