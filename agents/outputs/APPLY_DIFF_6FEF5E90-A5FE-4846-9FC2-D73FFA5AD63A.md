# Apply diff — Agent 3
run_id: 6FEF5E90-A5FE-4846-9FC2-D73FFA5AD63A
timestamp: 2026-07-18T00:00:00-03:00

## Acção proposta

Criar o worker interno Inngest que executará `admin_recalc_all_aggregates` com `service_role` após receber um evento autorizado.

## Diff

```diff
--- /dev/null
+++ b/apps/web/src/inngest/functions/admin-recalc-all-aggregates.ts
@@
+import { createClient } from "@supabase/supabase-js";
+import { inngest } from "@/inngest/client";
+
+export const adminRecalcAllAggregates = inngest.createFunction(
+  { id: "admin-recalc-all-aggregates", retries: 2 },
+  { event: "admin/health.recalc-all-aggregates.requested" },
+  async ({ event, step }) => { /* service-role RPC */ }
+);
```

## Verificação prévia

- `P0_CHECKLIST.md`: todos os itens marcados, nenhum FAIL.
- O worker é interno e não constitui endpoint humano.
- A chave privilegiada permanece exclusivamente no processo server-side.

## Reversão

Remover o ficheiro antes de o registar no endpoint Inngest.
