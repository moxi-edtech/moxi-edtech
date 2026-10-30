-- KLASSE: preserve executed statements and fix three unrelated exact-match version drifts.
-- OPS-ONLY; no application or fiscal SQL executed and no migration file created.
-- Compare full SQL equality to the repository before applying; hashes below
-- are of verified remote statements. Idempotent, atomic, fail closed.
DO $repair$
DECLARE
  v_map jsonb:=$rows$[{"old_version":"20260928105542","new_version":"20260928120000","name":"klasse_chatgpt_write_rpcs","hash":"14d085aea1a45475497c9bef433758c2"},{"old_version":"20261023120619","new_version":"20271023100000","name":"command_center_internal_roles","hash":"6d73ae548983d570a86a196d85da76e0"},{"old_version":"20261023120624","new_version":"20271023101000","name":"command_center_internal_global_search","hash":"b49a0543d09a450c39660a246e803e5a"}]$rows$::jsonb;
  v record;
  v_name text;
  v_hash text;
  v_old integer:=0;
  v_new integer:=0;
  v_affected integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
  FOR v IN SELECT * FROM jsonb_to_recordset(v_map)
    AS x(old_version text,new_version text,name text,hash text)
  LOOP
    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations WHERE version=v.old_version;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.name OR v_hash IS DISTINCT FROM v.hash THEN
        RAISE EXCEPTION 'SOURCE_MISMATCH for %',v.old_version;
      END IF;
      v_old:=v_old+1;
    END IF;
    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations WHERE version=v.new_version;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.name OR v_hash IS DISTINCT FROM v.hash THEN
        RAISE EXCEPTION 'TARGET_MISMATCH for %',v.new_version;
      END IF;
      v_new:=v_new+1;
    END IF;
  END LOOP;
  IF v_old=0 AND v_new=3 THEN RETURN; END IF;
  IF v_old<>3 OR v_new<>0 THEN
    RAISE EXCEPTION 'PARTIAL_MIGRATION_DRIFT old %, new %',v_old,v_new;
  END IF;
  FOR v IN SELECT * FROM jsonb_to_recordset(v_map)
    AS x(old_version text,new_version text,name text,hash text)
  LOOP
    UPDATE supabase_migrations.schema_migrations
      SET version=v.new_version
      WHERE version=v.old_version AND name=v.name AND md5(statements[1])=v.hash;
    GET DIAGNOSTICS v_affected=ROW_COUNT;
    IF v_affected<>1 THEN RAISE EXCEPTION 'UPDATE_ROW_COUNT_MISMATCH %',v.old_version; END IF;
  END LOOP;
END
$repair$;
