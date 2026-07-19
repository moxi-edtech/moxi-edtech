# Diff proposto — Agent 3
run_id: B0F30174-0162-4442-BFEC-ED2B0DD581C6
timestamp: 2026-07-19T01:25:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `PUBLIC/anon` de 16 RPCs autenticadas do aluno e serviços auxiliares, preservando `authenticated` e `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718171000_revoke_anon_student_and_auxiliary_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718171000_revoke_anon_student_and_auxiliary_execute.sql
@@
+BEGIN;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p
+    JOIN pg_namespace n ON n.oid=p.pronamespace
+    WHERE n.nspname='public' AND p.proname = ANY (ARRAY[
+      'aluno_solicitar_servico','aluno_submeter_comprovativo_pagamento',
+      'aluno_submeter_comprovativo_servico','build_numero_login','calcular_status_pedagogico',
+      'create_audit_event','emitir_recibo','enqueue_outbox_event_professor','enqueue_outbox_event',
+      'gradeengine_calcular_situacao','inserir_notificacao','matricula_counter_floor',
+      'next_matricula_number','next_numero_counter','next_numero_processo','preview_matricula_number'
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
16/16 assinaturas com `anon = false`, `authenticated = true`, `service_role = true`.
