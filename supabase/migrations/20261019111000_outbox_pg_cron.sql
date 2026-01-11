CREATE OR REPLACE FUNCTION public.process_outbox_events(p_limit int DEFAULT 25)
RETURNS TABLE(claimed int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock boolean;
  v_claimed int := 0;
BEGIN
  v_lock := pg_try_advisory_lock(hashtext('outbox_worker_v1'));
  IF NOT v_lock THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  PERFORM public.outbox_requeue_stuck();

  SELECT COUNT(*) INTO v_claimed
  FROM public.outbox_events
  WHERE status IN ('pending', 'failed')
    AND next_run_at <= now();

  PERFORM pg_advisory_unlock(hashtext('outbox_worker_v1'));

  RETURN QUERY SELECT v_claimed;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_outbox_events') THEN
      PERFORM cron.schedule(
        'process_outbox_events',
        '*/2 * * * *',
        'SELECT public.process_outbox_events(25);'
      );
    END IF;
  END IF;
END $$;
