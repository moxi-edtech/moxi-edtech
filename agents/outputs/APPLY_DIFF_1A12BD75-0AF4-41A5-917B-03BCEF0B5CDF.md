# Apply diff — Agent 3
run_id: 1A12BD75-0AF4-41A5-917B-03BCEF0B5CDF
timestamp: 2026-07-26T13:02:17Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Expor no contrato do KLASSE Brain os metadados de insight necessários ao vínculo.

## Diff proposto
```diff
 klasse-brain.ts
+ insight, toolId e aiInsightId opcionais em AssistantResponse
```

## Risco
Baixo: extensão retrocompatível de resposta.

## Reversão
Um único `git revert`.
