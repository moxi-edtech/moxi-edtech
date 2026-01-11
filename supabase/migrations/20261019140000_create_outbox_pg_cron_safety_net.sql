begin;

-- Drop old pg_cron schedule for process_outbox_events if it exists
select cron.unschedule('process_outbox_events');

-- Create pg_cron safety net for releasing stuck processing events
select cron.schedule(
  'outbox_release_stuck_processing',
  '*/10 * * * *',
  $$update public.outbox_events
      set status = 'failed',
          locked_at = null,
          locked_by = null,
          next_attempt_at = now(),
          last_error = coalesce(last_error,'') || ' | released_stuck_processing'
    where status = 'processing'
      and locked_at < now() - interval '15 minutes';$$
);

commit;
