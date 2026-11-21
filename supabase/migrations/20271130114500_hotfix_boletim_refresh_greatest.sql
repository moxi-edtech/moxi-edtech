-- Hotfix already applied through Supabase after first controlled production run.
-- GREATEST is a SQL expression and cannot be schema-qualified.
-- Keep this forward-only migration for upgrades and replay of the P1 migrations.
BEGIN;

CREATE OR REPLACE FUNCTION internal.refresh_boletim_if_dirty(p_force boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_dirty bigint;
  v_refreshed bigint;
  v_last_at timestamptz;
BEGIN
  -- Avoid overlapping automatic/maintenance refreshes without locking writes
  -- to academic source tables during the expensive MV operation.
  IF p_force THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(184103, 91);
  ELSIF NOT pg_catalog.pg_try_advisory_xact_lock(184103, 91) THEN
    RETURN 'busy';
  END IF;

  SELECT dirty_version,refreshed_version,last_refreshed_at
  INTO v_dirty,v_refreshed,v_last_at
  FROM internal.boletim_refresh_state
  WHERE singleton;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boletim change tracking not initialized';
  END IF;

  -- 24h safety reconciliation catches rare operations bypassing normal triggers
  -- (e.g. restore/replication), without hourly writes while the school is idle.
  IF NOT p_force AND v_dirty = v_refreshed
     AND v_last_at IS NOT NULL
     AND v_last_at > pg_catalog.clock_timestamp() - interval '24 hours'
  THEN
    RETURN 'unchanged';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula;

  -- Snapshot was taken before REFRESH. If a concurrent academic transaction
  -- committed meanwhile, its version remains higher and the next cron retries.
  UPDATE internal.boletim_refresh_state
  SET refreshed_version = GREATEST(refreshed_version, v_dirty),
      last_refreshed_at = pg_catalog.clock_timestamp()
  WHERE singleton;

  RETURN 'refreshed';
END;
$fn$;
REVOKE ALL ON FUNCTION internal.refresh_boletim_if_dirty(boolean)
FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
