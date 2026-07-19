# Diff proposto — Agent 3
run_id: AC3A3D10-CA1B-4F81-8F88-D5A001581A66
timestamp: 2026-07-19T01:05:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `PUBLIC/anon` de 27 RPCs de leitura operacional sensível, preservando `authenticated` e `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718170000_revoke_anon_sensitive_operational_reads.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718170000_revoke_anon_sensitive_operational_reads.sql
@@
+BEGIN;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p
+    JOIN pg_namespace n ON n.oid=p.pronamespace
+    WHERE n.nspname='public' AND p.proname = ANY (ARRAY[
+      'get_aluno_dossier','get_aluno_timeline_360','get_classes_sem_preco','get_config_impact',
+      'get_conselho_turma_risco','get_curso_professor_responsavel_map','get_estado_academico',
+      'get_import_summary','get_metricas_acesso_alunos','get_outbox_status_summary',
+      'get_pedagogico_prontidao_lancamentos','get_pending_turmas_count','get_professor_atribuicoes',
+      'get_profile_dependencies','get_propinas_por_turma','get_real_school_implantation_checklist',
+      'get_recent_cron_runs','get_school_operational_readiness','get_setup_state',
+      'get_staging_alunos_summary','get_teacher_assignments_by_profiles','get_teacher_compliance_status',
+      'get_turma_disciplinas_pedagogico','get_turma_notas_pendentes_detalhe',
+      'get_turma_occupancy_history','get_turmas_pedagogico_stats','get_users_by_role'
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
27/27 assinaturas com `anon = false`, `authenticated = true`, `service_role = true`.
