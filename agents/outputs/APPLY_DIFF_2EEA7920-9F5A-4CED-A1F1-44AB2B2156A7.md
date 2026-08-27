# KLASSE — Apply Diff
run_id: 2EEA7920-9F5A-4CED-A1F1-44AB2B2156A7
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/src/components/secretaria/virada-ano/ViradaWizard.tsx`

## Diff proposto

```diff
+ remover estado e imports obsoletos do fluxo antigo
+ calcular exceções sem memoização instável
+ permitir chegar à revisão de exceções, mantendo bloqueio final no backend
```

## Reversão

Um único `git revert` restaura as condições anteriores.
