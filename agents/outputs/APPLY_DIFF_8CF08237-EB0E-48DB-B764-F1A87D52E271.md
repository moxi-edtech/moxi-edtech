# Apply Diff — Agent 3
run_id: 8CF08237-EB0E-48DB-B764-F1A87D52E271
timestamp: 2026-07-18T00:00:00-03:00

## Acção

Remover execução anónima e herdada de `PUBLIC` dos helpers internos de tenant/autorização confirmados live, preservando `authenticated` e `service_role`.

## Diff proposto

```diff
--- /dev/null
+++ supabase/migrations/20270718191000_revoke_anon_internal_auth_helpers.sql
@@
+BEGIN;
+
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN
+    SELECT p.oid::regprocedure
+    FROM pg_proc p
+    JOIN pg_namespace n ON n.oid = p.pronamespace
+    WHERE n.nspname = 'public'
+      AND p.proname = ANY (ARRAY[
+        'can_access_formacao_backoffice','can_access_formacao_cohort_as_formador',
+        'can_access_formacao_fatura_as_formando','can_manage_school',
+        'can_manage_school_notifications','can_use_klasse_ai','current_tenant_escola_id',
+        'fiscal_empresa_has_members','get_my_escola_id','get_my_escola_ids',
+        'has_access_to_escola','is_escola_admin','is_escola_diretor','is_escola_member',
+        'is_membro_escola','is_super_admin','is_super_or_global_admin',
+        'portal_user_can_access_aluno','user_has_role_in_empresa','user_has_role_in_school'
+      ])
+  LOOP
+    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
+    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
+  END LOOP;
+END
+$migration$;
+
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN
+    SELECT p.oid::regprocedure
+    FROM pg_proc p
+    JOIN pg_namespace n ON n.oid = p.pronamespace
+    WHERE n.nspname = 'public'
+      AND p.proname = ANY (ARRAY[
+        'require_influencer_active_session','require_influencer_owner_session'
+      ])
+  LOOP
+    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
+    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
+  END LOOP;
+END
+$migration$;
+
+COMMIT;
```

## Exclusão deliberada

`check_public_rate_limit` permanece executável por `anon` porque duas rotas públicas o chamam directamente.

## Reversão

Reatribuir os grants anteriores às assinaturas listadas.
