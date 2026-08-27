# KLASSE — Apply Diff
run_id: 4CFFB728-A54D-4BA0-8E8D-77846C32F397
timestamp: 2026-08-01T20:02:03Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — hardening da MV após auditoria do banco real.

## Diff proposto

```diff
*** Update File: supabase/migrations/20270730230000_create_operacoes_dashboard_work_mv.sql
- Acesso `authenticated` direto à MV interna.
+ MV interna acessível somente por `service_role`.
+ Wrapper com filtro explícito por `auth.uid()` e `security_barrier`.
+ Índice não-único `pautas_lote_jobs(escola_id, status)`.
```

## Risco e reversão

Risco baixo: endurece grants e adiciona índice não-único; não altera dados.
Reversão: migration compensatória limitada aos novos artefactos.

## Meta de performance

Refresh fora do request; índice composto reduz custo de leituras por escola/status.
