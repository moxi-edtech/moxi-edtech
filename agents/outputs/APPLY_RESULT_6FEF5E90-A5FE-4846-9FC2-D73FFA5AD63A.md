# Apply result — Agent 3
run_id: 6FEF5E90-A5FE-4846-9FC2-D73FFA5AD63A
timestamp: 2026-07-18T00:00:00-03:00
status: REVERTED

## Verificação

`pnpm --filter web typecheck`: FAIL — a versão instalada do Inngest espera dois argumentos em `createFunction`.

## Reversão automática

O ficheiro `apps/web/src/inngest/functions/admin-recalc-all-aggregates.ts` foi removido integralmente. Nenhum comportamento da aplicação foi alterado.
