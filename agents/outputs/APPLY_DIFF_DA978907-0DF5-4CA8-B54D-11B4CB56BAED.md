# Diff proposto — Agent 3
run_id: DA978907-0DF5-4CA8-B54D-11B4CB56BAED
timestamp: 2026-07-19T01:45:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `anon` de cinco utilitários administrativos e restringir `audit_request_context()` a `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718172000_harden_diagnostic_utility_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718172000_harden_diagnostic_utility_execute.sql
@@
+BEGIN;
+REVOKE EXECUTE ON FUNCTION public.audit_request_context() FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.audit_request_context() TO service_role;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOREACH signature IN ARRAY ARRAY[
+    'public.check_super_admin_role()'::regprocedure,
+    'public.create_or_get_turma_by_code(uuid,integer,text)'::regprocedure,
+    'public.get_public_slug_for_current_tenant(uuid)'::regprocedure,
+    'public.partitions_info()'::regprocedure,
+    'public.set_communication_outbox_action(uuid,text)'::regprocedure
+  ] LOOP
+    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
+    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
+  END LOOP;
+END
+$migration$;
+COMMIT;
```

## Verificação pós-apply prevista
6/6 sem `anon`; cinco mantêm `authenticated`; `audit_request_context()` fica apenas com `service_role`.
