# KLASSE — Apply Result
run_id: 927EB80A-8351-4354-A2D4-8BFCBD0C073B
status: PASS

## Alteração

O loader passou a consumir `vw_operacoes_dashboard_work` para horários,
documentos e falhas de mensagens.

## Evidências

- `P0_CHECKLIST.md`: PASS.
- `pnpm --filter web typecheck`: PASS.
- ESLint direcionado com `--max-warnings 0`: PASS.
- `git diff --check`: PASS.
- Query filtrada por `escola_id` e retornando uma linha derivada.

## Meta p95

Dashboard operacional inferior a 200 ms.
