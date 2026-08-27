# KLASSE — Apply Diff
run_id: 927EB80A-8351-4354-A2D4-8BFCBD0C073B
timestamp: 2026-07-30T23:03:12Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 3: ligação da MV ao loader.

## Diff proposto

```diff
*** Update File: apps/web/src/components/layout/operacoes/dashboard.data.ts
+ Tipo local da nova view sem editar tipos Supabase gerados.
+ Query paralela de `vw_operacoes_dashboard_work`.
+ Horários, documentos e mensagens falhadas alimentados pela MV.
+ Timestamp de atualização derivado do refresh da MV.
```

## Risco e reversão

Risco baixo/moderado: a query depende da migration correspondente no deploy.
Reversão: um único `git revert`.

## Meta de performance

Uma linha indexada por escola; dashboard p95 inferior a 200 ms.
