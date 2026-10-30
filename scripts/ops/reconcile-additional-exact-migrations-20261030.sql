-- KLASSE 2026-10-30: reconcile three additional Git-blob-identical migrations.
-- OPS-ONLY. Full SHA-1 Git blob equality and MD5 stored SQL were verified.
-- This changes no receipt, finance, academic, or fiscal application data.
DO $version_repair$
DECLARE
  v_map jsonb := $map$[{"old":"20261024230025","next":"20271015100001","old_name":"command_center_course_reused_classes_ex005","new_name":"command_center_course_reused_classes","hash":"43f6eadfbc8879e668d9b1362e1f9beb"},{"old":"20261024230032","next":"20271015100002","old_name":"command_center_course_turmas_page_ex007","new_name":"command_center_course_turmas_page","hash":"bd6b287352535bc69d8d101616b39fd3"},{"old":"20261026111331","next":"20271026123000","old_name":"operational_receipt_outbox_worker_20261026","new_name":"operational_receipt_outbox_worker","hash":"394d5a695e1263caa614fc9ab28b24c4"}]$map$::jsonb;
  v record; v_name text; v_hash text;
  v_old integer := 0; v_new integer := 0; v_updated integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
  FOR v IN SELECT * FROM jsonb_to_recordset(v_map)
    AS x(old text,next text,old_name text,new_name text,hash text)
  LOOP
    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations WHERE version=v.old;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.old_name OR v_hash IS DISTINCT FROM v.hash THEN
        RAISE EXCEPTION 'SOURCE_MISMATCH %',v.old;
      END IF;
      v_old := v_old + 1;
    END IF;
    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations WHERE version=v.next;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.new_name OR v_hash IS DISTINCT FROM v.hash THEN
        RAISE EXCEPTION 'TARGET_MISMATCH %',v.next;
      END IF;
      v_new := v_new + 1;
    END IF;
  END LOOP;
  IF v_old=0 AND v_new=3 THEN RETURN; END IF;
  IF v_old<>3 OR v_new<>0 THEN
    RAISE EXCEPTION 'MIGRATION_HISTORY_PARTIAL: old %, new %',v_old,v_new;
  END IF;
  FOR v IN SELECT * FROM jsonb_to_recordset(v_map)
    AS x(old text,next text,old_name text,new_name text,hash text)
  LOOP
    UPDATE supabase_migrations.schema_migrations
      SET version=v.next,name=v.new_name
    WHERE version=v.old AND name=v.old_name AND md5(statements[1])=v.hash;
    GET DIAGNOSTICS v_updated=ROW_COUNT;
    IF v_updated<>1 THEN RAISE EXCEPTION 'ROW_COUNT_INVALID %',v.old; END IF;
  END LOOP;
END
$version_repair$;
