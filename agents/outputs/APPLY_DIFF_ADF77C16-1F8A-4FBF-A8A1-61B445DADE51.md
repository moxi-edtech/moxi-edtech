# Diff proposto — Agent 3
run_id: ADF77C16-1F8A-4FBF-A8A1-61B445DADE51
timestamp: 2026-07-18T22:12:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover acesso `PUBLIC/anon` de seis RPCs de backoffice, preservando `authenticated` e `service_role` usados pelas rotas existentes.

## Ficheiro proposto
`supabase/migrations/20270718153000_revoke_anon_backoffice_function_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718153000_revoke_anon_backoffice_function_execute.sql
@@
+BEGIN;
+
+REVOKE EXECUTE ON FUNCTION public.fix_academic_session_ids(uuid) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.generate_partner_commission_for_saas_payment(uuid, uuid) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.increment_documento_print(uuid, uuid, text) FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.refresh_mv_escola_cursos_stats() FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.refresh_mv_turmas_para_matricula() FROM PUBLIC, anon;
+REVOKE EXECUTE ON FUNCTION public.sync_onboarding_workflow_state(uuid) FROM PUBLIC, anon;
+
+GRANT EXECUTE ON FUNCTION public.fix_academic_session_ids(uuid) TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.generate_partner_commission_for_saas_payment(uuid, uuid) TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.increment_documento_print(uuid, uuid, text) TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.refresh_mv_escola_cursos_stats() TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.refresh_mv_turmas_para_matricula() TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.sync_onboarding_workflow_state(uuid) TO authenticated, service_role;
+
+COMMIT;
```

## Verificação pós-apply prevista
As seis assinaturas devem ter `anon = false`, `authenticated = true` e `service_role = true`.
