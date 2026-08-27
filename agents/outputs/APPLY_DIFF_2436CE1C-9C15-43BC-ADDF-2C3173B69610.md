# KLASSE — Apply Diff
run_id: 2436CE1C-9C15-43BC-ADDF-2C3173B69610
timestamp: 2026-08-01T12:51:21Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 4: navegação financeira integral.

## Diff proposto

```diff
*** Update File: apps/web/src/lib/sidebarNav.ts
- Grupo financeiro limitado a três superfícies.
+ Grupo Financeiro com todas as superfícies do módulo.
+ Todos os destinos sob `/operacoes/financeiro/**`.
```

## Risco e reversão

Risco baixo/moderado: amplia a navegação visível sem alterar APIs ou dados.
Reversão: um único `git revert`.

## Meta de performance

Sem impacto relevante; configuração estática de navegação.
