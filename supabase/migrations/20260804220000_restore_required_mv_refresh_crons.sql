BEGIN;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'refresh_mv_radar_inadimplencia',
      'refresh_mv_pagamentos_status',
      'refresh_mv_secretaria_dashboard_counts',
      'refresh_mv_secretaria_matriculas_status',
      'refresh_mv_secretaria_matriculas_turma_status',
      'refresh_mv_admin_dashboard_counts',
      'refresh_mv_admin_matriculas_por_mes',
      'refresh_mv_cursos_reais'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule('refresh_mv_radar_inadimplencia', '3,33 * * * *', $$SELECT public.refresh_mv_radar_inadimplencia();$$);
SELECT cron.schedule('refresh_mv_pagamentos_status', '7,37 * * * *', $$SELECT public.refresh_mv_pagamentos_status();$$);
SELECT cron.schedule('refresh_mv_secretaria_dashboard_counts', '11,41 * * * *', $$SELECT public.refresh_mv_secretaria_dashboard_counts();$$);
SELECT cron.schedule('refresh_mv_secretaria_matriculas_status', '13,43 * * * *', $$SELECT public.refresh_mv_secretaria_matriculas_status();$$);
SELECT cron.schedule('refresh_mv_secretaria_matriculas_turma_status', '17,47 * * * *', $$SELECT public.refresh_mv_secretaria_matriculas_turma_status();$$);
SELECT cron.schedule('refresh_mv_admin_dashboard_counts', '19,49 * * * *', $$SELECT public.refresh_mv_admin_dashboard_counts();$$);
SELECT cron.schedule('refresh_mv_admin_matriculas_por_mes', '23,53 * * * *', $$SELECT public.refresh_mv_admin_matriculas_por_mes();$$);
SELECT cron.schedule('refresh_mv_cursos_reais', '29,59 * * * *', $$SELECT public.refresh_mv_cursos_reais();$$);

COMMIT;
