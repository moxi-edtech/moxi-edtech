BEGIN;

CREATE MATERIALIZED VIEW internal.mv_operacoes_dashboard_work AS
WITH active_classes AS (
  SELECT
    t.escola_id,
    t.id AS turma_id
  FROM public.turmas AS t
  JOIN public.anos_letivos AS al
    ON al.escola_id = t.escola_id
   AND al.ativo = true
   AND (
     t.ano_letivo_id = al.id
     OR (t.ano_letivo_id IS NULL AND t.ano_letivo = al.ano)
   )
),
published_classes AS (
  SELECT DISTINCT
    hv.escola_id,
    hv.turma_id
  FROM public.horario_versoes AS hv
  WHERE hv.status = 'publicada'
),
schedule_metrics AS (
  SELECT
    ac.escola_id,
    count(*) FILTER (WHERE pc.turma_id IS NULL)::integer
      AS classes_without_published_schedule,
    min(ac.turma_id::text) FILTER (WHERE pc.turma_id IS NULL)::uuid
      AS first_class_without_published_schedule_id
  FROM active_classes AS ac
  LEFT JOIN published_classes AS pc
    ON pc.escola_id = ac.escola_id
   AND pc.turma_id = ac.turma_id
  GROUP BY ac.escola_id
),
document_metrics AS (
  SELECT
    escola_id,
    count(*) FILTER (
      WHERE upper(status) IN ('PENDING', 'QUEUED', 'PROCESSING', 'FAILED')
    )::integer AS documents_pending
  FROM public.pautas_lote_jobs
  GROUP BY escola_id
),
communication_metrics AS (
  SELECT
    school_id AS escola_id,
    count(*) FILTER (WHERE status = 'failed')::integer AS failed_messages
  FROM public.communication_outbox
  GROUP BY school_id
)
SELECT
  e.id AS escola_id,
  coalesce(sm.classes_without_published_schedule, 0)
    AS classes_without_published_schedule,
  sm.first_class_without_published_schedule_id,
  coalesce(dm.documents_pending, 0) AS documents_pending,
  coalesce(cm.failed_messages, 0) AS failed_messages,
  now() AS refreshed_at
FROM public.escolas AS e
LEFT JOIN schedule_metrics AS sm ON sm.escola_id = e.id
LEFT JOIN document_metrics AS dm ON dm.escola_id = e.id
LEFT JOIN communication_metrics AS cm ON cm.escola_id = e.id;

CREATE UNIQUE INDEX ux_mv_operacoes_dashboard_work
  ON internal.mv_operacoes_dashboard_work (escola_id);

CREATE INDEX IF NOT EXISTS idx_pautas_lote_jobs_escola_status
  ON public.pautas_lote_jobs (escola_id, status);

CREATE OR REPLACE FUNCTION public.refresh_mv_operacoes_dashboard_work()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'internal'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_operacoes_dashboard_work;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_mv_operacoes_dashboard_work()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_operacoes_dashboard_work()
  TO service_role;

CREATE OR REPLACE VIEW public.vw_operacoes_dashboard_work
WITH (security_barrier = true)
AS
SELECT
  m.escola_id,
  m.classes_without_published_schedule,
  m.first_class_without_published_schedule_id,
  m.documents_pending,
  m.failed_messages,
  m.refreshed_at
FROM internal.mv_operacoes_dashboard_work AS m
WHERE m.escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users AS eu
  WHERE eu.user_id = (SELECT auth.uid())
);

REVOKE ALL ON internal.mv_operacoes_dashboard_work
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON internal.mv_operacoes_dashboard_work TO service_role;
REVOKE ALL ON public.vw_operacoes_dashboard_work FROM PUBLIC, anon;
GRANT SELECT ON public.vw_operacoes_dashboard_work TO authenticated, service_role;

DO $block$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'refresh_mv_operacoes_dashboard_work'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$block$;

SELECT cron.schedule(
  'refresh_mv_operacoes_dashboard_work',
  '2-59/5 * * * *',
  $cron$SELECT public.refresh_mv_operacoes_dashboard_work();$cron$
);

COMMIT;
