# KLASSE — Apply Diff
run_id: 18349A32-EFBF-4FCD-B30A-DD8C6E7F7E76
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/tests/unit/academic-year-rollover-gate.spec.ts`

## Diff proposto

```diff
+ testar a fronteira da data final, a expiração no dia seguinte e a matriz de papéis
```

## Reversão

Um único `git revert` remove apenas os testes do gate.
