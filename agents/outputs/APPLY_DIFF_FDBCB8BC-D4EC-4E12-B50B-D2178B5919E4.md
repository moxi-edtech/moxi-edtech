# Diff proposto — Agent 3
run_id: FDBCB8BC-D4EC-4E12-B50B-D2178B5919E4
timestamp: 2026-07-19T00:45:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `PUBLIC/anon` de 22 assinaturas administrativas restantes, preservando `authenticated` e `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718165000_revoke_anon_remaining_admin_operations.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718165000_revoke_anon_remaining_admin_operations.sql
@@
+BEGIN;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p
+    JOIN pg_namespace n ON n.oid=p.pronamespace
+    WHERE n.nspname='public' AND p.proname = ANY (ARRAY[
+      'conciliar_transacoes_auto_match','confirmar_conciliacao_transacao','fn_transitar_alunos',
+      'gerar_historico_anual','gerar_mapa_aproveitamento_turma','gerar_mensalidades_lote',
+      'gerar_turmas_from_curriculo','hard_delete_aluno','historico_set_snapshot_state',
+      'horario_auto_configurar_cargas','importar_alunos','lock_curriculo_install',
+      'move_profile_to_archive','registrar_venda_avulsa','remediate_cutover_gaps',
+      'resync_matricula_counter','update_import_configuration','validate_curriculum_presets',
+      'validate_onboarding_implantation_acceptance','validate_presets_global'
+    ])
+  LOOP
+    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
+    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
+  END LOOP;
+END
+$migration$;
+COMMIT;
```

## Verificação pós-apply prevista
22/22 assinaturas com `anon = false`, `authenticated = true`, `service_role = true`.
