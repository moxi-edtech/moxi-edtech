# KLASSE — Apply Diff
run_id: 5781FD2D-CDAB-462D-B1AA-3AC21CD2843E
timestamp: 2026-07-30T23:05:47Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 3: breadcrumb contextual do aluno.

## Diff proposto

```diff
*** Update File: apps/web/src/components/aluno/DossierHeader.tsx
+ Breadcrumb inferido pelo pathname.
+ Label `Operações` quando aberto pelo portal operacional.
+ Destino contextual sem reentrada em Admin/Secretaria.
```

## Risco e reversão

Risco baixo: mudança apenas em navegação e label.
Reversão: um único `git revert`.

## Meta de performance

Sem impacto no p95.
