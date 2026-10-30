-- Historical and idempotent ops-only ledger repair, NOT a Supabase migration.
-- Both DDL contracts were previously executed and verified in the KLASSE DB.
-- Do not execute the migration SQL again. This only reconciles two version IDs.
DO $ops$
DECLARE
  v_updated integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;

  -- system_maintenance_windows: exact executed payload matched GitHub source.
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261030225227') THEN
    IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20270519194000') THEN
      RAISE EXCEPTION 'Maintenance target migration version collision';
    END IF;
    UPDATE supabase_migrations.schema_migrations
      SET version='20270519194000'
    WHERE version='20261030225227'
      AND name='create_system_maintenance_windows'
      AND md5(statements[1])='8367f0d71ff0c8b49b923c728d6c999e';
    GET DIAGNOSTICS v_updated=ROW_COUNT;
    IF v_updated<>1 THEN RAISE EXCEPTION 'Maintenance origin verification failed'; END IF;
  ELSIF NOT EXISTS(
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20270519194000'
      AND name='create_system_maintenance_windows'
      AND md5(statements[1])='8367f0d71ff0c8b49b923c728d6c999e'
  ) THEN
    RAISE EXCEPTION 'Maintenance ledger entry missing/mismatched';
  END IF;

  -- The installed finance function was read from local worktree without the
  -- final LF byte; append only this LF to preserve exact Git blob equivalence.
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261030225425') THEN
    IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260808120000') THEN
      RAISE EXCEPTION 'Finance target migration version collision';
    END IF;
    UPDATE supabase_migrations.schema_migrations
      SET version='20260808120000',
          name='add_mensalidade_integrity_report',
          statements=ARRAY[statements[1] || E'\n']
    WHERE version='20261030225425'
      AND name='audit_mensalidades_integrity_tenant_guard'
      AND cardinality(statements)=1
      AND md5(statements[1] || E'\n')='1ec8057490825856be3f36997cd701a2';
    GET DIAGNOSTICS v_updated=ROW_COUNT;
    IF v_updated<>1 THEN RAISE EXCEPTION 'Finance origin verification failed'; END IF;
  ELSIF NOT EXISTS(
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20260808120000'
      AND name='add_mensalidade_integrity_report'
      AND cardinality(statements)=1
      AND md5(statements[1])='1ec8057490825856be3f36997cd701a2'
  ) THEN
    RAISE EXCEPTION 'Finance ledger entry missing/mismatched';
  END IF;
END $ops$;
