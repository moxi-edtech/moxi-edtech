BEGIN;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'refresh_mv_pagamentos_status',
      'refresh_mv_formacao_cohorts_lotacao',
      'refresh_mv_formacao_inadimplencia_resumo',
      'refresh_mv_formacao_margem_por_edicao'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_pagamentos_status',
  '7,37 * * * *',
  $$SELECT public.refresh_mv_pagamentos_status();$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_cohorts_lotacao',
  '11,41 * * * *',
  $$SELECT public.refresh_mv_formacao_cohorts_lotacao();$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_inadimplencia_resumo',
  '17,47 * * * *',
  $$SELECT public.refresh_mv_formacao_inadimplencia_resumo();$$
);

SELECT cron.schedule(
  'refresh_mv_formacao_margem_por_edicao',
  '23,53 * * * *',
  $$SELECT public.refresh_mv_formacao_margem_por_edicao();$$
);

COMMIT;
