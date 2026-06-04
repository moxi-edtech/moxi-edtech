BEGIN;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command = 'select public.process_outbox_batch(50);'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command = 'SELECT public.cleanup_pg_cron_history();'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_pg_cron_history()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'cron', 'public'
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM cron.job_run_details
  WHERE end_time < now() - interval '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_pg_cron_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_pg_cron_history() TO postgres, service_role;

SELECT public.cleanup_pg_cron_history();

SELECT cron.schedule(
  'cleanup-pg-cron-history-7d',
  '20 3 * * *',
  'SELECT public.cleanup_pg_cron_history();'
);

COMMIT;
