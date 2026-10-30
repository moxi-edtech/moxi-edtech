-- KLASSE 2026-10-30, migration-ledger reconciliation for stacked PR #306.
-- OPS-ONLY: this is NOT an application migration; do not add it to supabase/migrations.
-- All 13 migration statements were compared byte-for-byte against the PR files.
-- Preserve the executed SQL, rollback, idempotency keys, authors and row count.
-- Fail closed on collisions, unexpected payload hashes or partial repair.
-- No academic, financial, or auth data is modified.

DO $klasse_repair$
DECLARE
  v_map jsonb := $mapping$
[
  {
    "old_version": "20261030205800",
    "new_version": "20271029235900",
    "old_name": "lifecycle_contextual_status_ssot_v2_stack",
    "new_name": "lifecycle_contextual_status_ssot_v2",
    "sql_md5": "7626047bb957354d7b3b6a85b704032d"
  },
  {
    "old_version": "20261030205657",
    "new_version": "20271029235910",
    "old_name": "lifecycle_persisted_status_contract_v3",
    "new_name": "lifecycle_persisted_status_contract_v3",
    "sql_md5": "806bc974b497c6e8e5ee85cac364dd55"
  },
  {
    "old_version": "20261030205709",
    "new_version": "20271029235920",
    "old_name": "raa_balcao_authoritative_permissions",
    "new_name": "raa_balcao_authoritative_permissions",
    "sql_md5": "a010aa2cf89a2f45365d0308818ea205"
  },
  {
    "old_version": "20261030205721",
    "new_version": "20271029235921",
    "old_name": "guard_grade_period_source_and_window",
    "new_name": "guard_grade_period_source_and_window",
    "sql_md5": "7b45273a712a8219528b65edc0415bb3"
  },
  {
    "old_version": "20261030101904",
    "new_version": "20271029235922",
    "old_name": "canonical_med_calendar_offering_profiles",
    "new_name": "canonical_med_calendar_offering_profiles",
    "sql_md5": "17ddf2a0a9d36df25a391d310521ae86"
  },
  {
    "old_version": "20261030101925",
    "new_version": "20271029235923",
    "old_name": "apply_canonical_med_calendar_atomic",
    "new_name": "apply_canonical_med_calendar_atomic",
    "sql_md5": "0ab684b142520a4ec89037b9eca14fc2"
  },
  {
    "old_version": "20261030205729",
    "new_version": "20271029235924",
    "old_name": "guard_fechamento_academico_jobs_rls",
    "new_name": "guard_fechamento_academico_jobs_rls",
    "sql_md5": "52c9a8beae474d0d4f9f6e2b64b9ca23"
  },
  {
    "old_version": "20261030103711",
    "new_version": "20271029235926",
    "old_name": "global_curriculum_med_calendar_contract",
    "new_name": "global_curriculum_med_calendar_contract",
    "sql_md5": "50945537c1d382e11e79cb3cf49329b4"
  },
  {
    "old_version": "20261030105217",
    "new_version": "20271029235927",
    "old_name": "med_annual_offering_profiles",
    "new_name": "med_annual_offering_profiles",
    "sql_md5": "05b8b7fc46a1544985909941f5feda69"
  },
  {
    "old_version": "20261030105229",
    "new_version": "20271029235928",
    "old_name": "med_year_activation_readiness",
    "new_name": "med_year_activation_readiness",
    "sql_md5": "a0daa8c050d03ab0baaec524928290f4"
  },
  {
    "old_version": "20261030110307",
    "new_version": "20271029235929",
    "old_name": "guard_med_initial_year",
    "new_name": "guard_med_initial_year",
    "sql_md5": "d797fcd33b27708446182727135695f6"
  },
  {
    "old_version": "20261030110318",
    "new_version": "20271029235930",
    "old_name": "bootstrap_med_terms_on_new_school",
    "new_name": "bootstrap_med_terms_on_new_school",
    "sql_md5": "b04cd0a5fda39f0df80e08383756d67e"
  },
  {
    "old_version": "20261030111053",
    "new_version": "20271029235931",
    "old_name": "cutover_activate_year_order",
    "new_name": "cutover_activate_year_order",
    "sql_md5": "772f45bf87c000e775fe189a4847b003"
  }
]
$mapping$::jsonb;
  v RECORD;
  v_name text;
  v_hash text;
  v_source_count integer := 0;
  v_target_count integer := 0;
  v_rows integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;

  FOR v IN
    SELECT * FROM jsonb_to_recordset(v_map)
    AS m(old_version text, new_version text, old_name text,
         new_name text, sql_md5 text)
  LOOP
    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations
      WHERE version=v.old_version;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.old_name OR v_hash IS DISTINCT FROM v.sql_md5 THEN
        RAISE EXCEPTION 'SOURCE_MISMATCH: % (name %, hash %)',
          v.old_version,v_name,v_hash;
      END IF;
      v_source_count:=v_source_count+1;
    END IF;

    SELECT name,md5(statements[1]) INTO v_name,v_hash
      FROM supabase_migrations.schema_migrations
      WHERE version=v.new_version;
    IF FOUND THEN
      IF v_name IS DISTINCT FROM v.new_name OR v_hash IS DISTINCT FROM v.sql_md5 THEN
        RAISE EXCEPTION 'TARGET_MISMATCH: % (name %, hash %)',
          v.new_version,v_name,v_hash;
      END IF;
      v_target_count:=v_target_count+1;
    END IF;
  END LOOP;

  IF v_source_count=0 AND v_target_count=13 THEN
    RAISE NOTICE 'KLASSE migration ledger already reconciled (13/13).';
    RETURN;
  END IF;
  IF v_source_count<>13 OR v_target_count<>0 THEN
    RAISE EXCEPTION
      'PARTIAL_OR_COLLIDING_LEDGER: source %/13, target %/13; no rows changed',
      v_source_count,v_target_count;
  END IF;

  FOR v IN
    SELECT * FROM jsonb_to_recordset(v_map)
    AS m(old_version text, new_version text, old_name text,
         new_name text, sql_md5 text)
  LOOP
    UPDATE supabase_migrations.schema_migrations
       SET version=v.new_version, name=v.new_name
     WHERE version=v.old_version
       AND name=v.old_name
       AND md5(statements[1])=v.sql_md5;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN
      RAISE EXCEPTION 'LEDGER_REPAIR_ROWCOUNT: % changed % rows',v.old_version,v_rows;
    END IF;
  END LOOP;
  RAISE NOTICE 'KLASSE migration ledger reconciled: 13 rows, no SQL replay.';
END
$klasse_repair$;
