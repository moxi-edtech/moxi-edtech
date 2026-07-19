BEGIN;

DO $migration$
DECLARE signature regprocedure;
BEGIN
  FOR signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'aprovar_turmas','assign_professor_turma_disciplina_atomic',
        'clone_academic_structure','clone_academic_structure_v1','config_commit',
        'curriculo_backfill_matriz_from_preset','curriculo_install_orchestrated',
        'curriculum_preset_subjects_delete','curriculum_preset_subjects_upsert',
        'curriculum_presets_delete','curriculum_presets_upsert','curriculum_recalc_status',
        'cutover_ano_letivo_v1','cutover_ano_letivo_v2','cutover_ano_letivo_v3',
        'importar_alunos_v2','importar_alunos_v4','matricular_em_massa',
        'matricular_em_massa_por_turma','onboard_academic_structure_from_matrix',
        'preview_apply_changes','setup_active_ano_letivo','upsert_bulk_periodos_letivos'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
