# KLASSE — Apply Diff
run_id: B0BCB0CB-35F9-40E4-B3A2-0B088CFC4A10
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/tests/unit/k12-rollover-wizard.spec.ts`

## Diff proposto

```diff
+ garantir por contrato que o wizard tem três fases e não contém regras do Curtume
+ garantir pré-validação automática e confirmação final explícita
```

## Reversão

Um único `git revert` remove apenas o teste de contrato.
