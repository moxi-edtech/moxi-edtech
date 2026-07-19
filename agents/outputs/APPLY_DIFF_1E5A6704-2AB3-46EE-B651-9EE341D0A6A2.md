# Diff proposto — Agent 3
run_id: 1E5A6704-2AB3-46EE-B651-9EE341D0A6A2
timestamp: 2026-07-19T02:45:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Restringir dois utilitários sem consumidores a `service_role` e remover `anon` da RPC autenticada de branding.

## Ficheiro proposto
`supabase/migrations/20270718175000_harden_school_utility_execute.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718175000_harden_school_utility_execute.sql
@@
+BEGIN;
+REVOKE EXECUTE ON FUNCTION public.generate_unique_numero_login(uuid,user_role,text,integer) FROM PUBLIC, anon, authenticated;
+REVOKE EXECUTE ON FUNCTION public.get_escola_sigla(uuid) FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.generate_unique_numero_login(uuid,user_role,text,integer) TO service_role;
+GRANT EXECUTE ON FUNCTION public.get_escola_sigla(uuid) TO service_role;
+REVOKE EXECUTE ON FUNCTION public.get_escola_document_branding(uuid) FROM PUBLIC, anon;
+GRANT EXECUTE ON FUNCTION public.get_escola_document_branding(uuid) TO authenticated, service_role;
+COMMIT;
```

## Verificação pós-apply prevista
3/3 sem `anon`; dois internos sem `authenticated`; branding mantém `authenticated`; 3/3 mantêm `service_role`.
