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
        'conciliar_transacoes_auto_match','confirmar_conciliacao_transacao','fn_transitar_alunos',
        'gerar_historico_anual','gerar_mapa_aproveitamento_turma','gerar_mensalidades_lote',
        'gerar_turmas_from_curriculo','hard_delete_aluno','historico_set_snapshot_state',
        'horario_auto_configurar_cargas','importar_alunos','lock_curriculo_install',
        'move_profile_to_archive','registrar_venda_avulsa','remediate_cutover_gaps',
        'resync_matricula_counter','update_import_configuration','validate_curriculum_presets',
        'validate_onboarding_implantation_acceptance','validate_presets_global'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
  END LOOP;
END
$migration$;

COMMIT;
