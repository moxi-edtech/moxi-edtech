# Apply diff — Agent 3
run_id: 788DF95F-A8AC-4A41-896D-4D1EF47D11CF
timestamp: 2026-07-18T00:00:00-03:00

## Acção proposta

Recriar o worker interno com a assinatura `createFunction(options, handler)` compatível com a versão instalada do Inngest.

## Diff

```diff
--- /dev/null
+++ b/apps/web/src/inngest/functions/admin-recalc-all-aggregates.ts
@@
+export const adminRecalcAllAggregates = inngest.createFunction(
+  { id: "admin-recalc-all-aggregates", retries: 2,
+    triggers: [{ event: "admin/health.recalc-all-aggregates.requested" }] },
+  async ({ event, step }) => { /* service-role RPC */ }
+);
```

## Verificação prévia

- `P0_CHECKLIST.md`: nenhum FAIL.
- Ajuste baseado na assinatura já usada pelos workers existentes deste repositório.

## Reversão

Remover o novo ficheiro.
