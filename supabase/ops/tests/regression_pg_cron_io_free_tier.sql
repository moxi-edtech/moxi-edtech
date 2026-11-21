-- Run after 20271130090000_consolidate_pg_cron_io_free_tier.sql.
-- Read-only regression: canonical data refresh must stay scheduled.
DO $verify$
DECLARE
  v_mismatch text;
BEGIN
  IF (SELECT count(*) FROM cron.job WHERE jobname='refresh_mv_pagamentos_status'
      AND active AND btrim(command)='SELECT public.refresh_mv_pagamentos_status();') <> 1 THEN
    RAISE EXCEPTION 'IO regression: expected one active canonical payment refresh';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job
             WHERE active AND jobname='fin-pagamentos-status-5m') THEN
    RAISE EXCEPTION 'IO regression: redundant payment refresh still active';
  END IF;

  SELECT string_agg(jobname, ', ') INTO v_mismatch
  FROM cron.job
  WHERE active AND jobname='refresh-audit-metrics-daily'
    AND schedule='18 * * * *';
  IF v_mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'IO regression: audit summary still refreshing hourly';
  END IF;

  -- Transactional workers must never be disabled by cost optimizations.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE active AND jobname='outbox-db-worker-1m') OR
     NOT EXISTS (SELECT 1 FROM cron.job WHERE active AND jobname='operational-receipts-1m') THEN
    RAISE EXCEPTION 'IO regression: critical outbox/receipt worker disabled';
  END IF;
END;
$verify$;
