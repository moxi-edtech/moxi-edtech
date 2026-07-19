# Diff proposto — Agent 3
run_id: 1AF8A098-D0DE-41F9-B543-E3C2E223BF33
timestamp: 2026-07-18T22:00:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Evidência
O único produtor de `marketing_leads` encontrado é `apps/landing/app/api/leads/route.ts`, que usa `SUPABASE_SERVICE_ROLE_KEY`. A policy pública de INSERT não é necessária ao fluxo.

## Ficheiro proposto
`supabase/migrations/20270718152000_remove_public_marketing_leads_insert_policy.sql`

```diff
--- /dev/null
+++ b/supabase/migrations/20270718152000_remove_public_marketing_leads_insert_policy.sql
@@
+BEGIN;
+
+DROP POLICY IF EXISTS "Enable insert for everyone" ON public.marketing_leads;
+REVOKE INSERT ON TABLE public.marketing_leads FROM PUBLIC, anon, authenticated;
+
+COMMIT;
```

## Verificação pós-apply prevista

- Policy permissiva inexistente.
- `anon` e `authenticated` sem INSERT efectivo.
- `service_role` mantém INSERT.
