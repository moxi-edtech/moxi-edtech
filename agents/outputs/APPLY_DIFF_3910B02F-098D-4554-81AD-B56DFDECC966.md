# KLASSE — Apply Diff
run_id: 3910B02F-098D-4554-81AD-B56DFDECC966
timestamp: 2026-07-30T22:47:37Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 1: normalização das filas operacionais.

## Diff proposto

```diff
*** Add File: apps/web/src/components/layout/operacoes/dashboard.model.ts
+ Snapshot de métricas derivadas usado como fronteira do loader.
+ Mapper determinístico para resumo e prioridades do cockpit.
+ Links contextuais exclusivamente em `/operacoes/**`.
+ Ordenação estável por severidade, área e identificador.
```

## Risco e reversão

Risco baixo: módulo puro ainda não ligado ao runtime.
Reversão: remover o novo ficheiro num único `git revert`.

## Meta de performance

Transformação linear em memória; dados de entrada devem vir de views/MVs ou derivados.
