# Apply diff — Agent 3
run_id: 9F9AE139-CD7F-4D75-BF11-768D0A9E4344
timestamp: 2026-07-26T12:57:20Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Adicionar severidade calculada ao contrato estruturado de insight.

## Diff proposto
```diff
 data-copilot/types.ts
+ InsightSeverity
+ severity opcional em InsightAnswer
```

## Risco
Baixo: extensão retrocompatível do contrato.

## Reversão
Um único `git revert`.
