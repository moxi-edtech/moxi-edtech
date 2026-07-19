# Diff proposto — Agent 3
run_id: 53CC8E5F-B6B4-4FB9-8EF3-1EE5294F3CE6
timestamp: 2026-07-19T00:05:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover `PUBLIC/anon` de 18 assinaturas de super-admin/provisionamento, preservando `authenticated` e `service_role`.

## Ficheiro proposto
`supabase/migrations/20270718163000_revoke_anon_super_admin_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718163000_revoke_anon_super_admin_execute.sql
@@
+BEGIN;
+DO $migration$
+DECLARE signature regprocedure;
+BEGIN
+  FOR signature IN SELECT p.oid::regprocedure FROM pg_proc p
+    JOIN pg_namespace n ON n.oid=p.pronamespace
+    WHERE n.nspname='public' AND p.proname = ANY (ARRAY[
+      'create_afiliado_admin','create_afiliado_membro_admin','create_influencer_admin',
+      'create_influencer_member_admin','list_afiliado_membros_admin','list_afiliados_admin',
+      'list_influencer_members_admin','list_influencers_admin','toggle_afiliado_admin',
+      'toggle_afiliado_membro_admin','toggle_influencer_admin','toggle_influencer_member_admin',
+      'create_and_provision_escola_from_onboarding','create_escola_with_admin',
+      'provisionar_escola_from_onboarding','update_escola_slug',
+      'super_admin_reclassificar_aluno_turma'
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
18/18 assinaturas com `anon = false`, `authenticated = true`, `service_role = true`.
