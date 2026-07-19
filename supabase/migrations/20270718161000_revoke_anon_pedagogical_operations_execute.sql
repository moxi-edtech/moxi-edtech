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
        'auto_assign_school_teachers_by_specialty','check_professor_operational_consistency',
        'create_or_update_professor_academico','emitir_documento_final','increment_pautas_lote_job',
        'lancar_notas_batch','liberar_acesso_alunos_v2','log_horario_event','next_documento_numero',
        'next_numero_chamada_for_turma','renumerar_matriculas_turma','request_liberar_acesso',
        'search_alunos_global','search_alunos_global_min','search_global_entities',
        'set_curso_professor_responsavel','set_secretaria_priority','snooze_secretaria_aviso',
        'soft_delete_aluno','tenant_profiles_by_ids','turma_set_status_fecho',
        'upsert_frequencias_batch','upsert_quadro_horarios_versao_atomic'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
