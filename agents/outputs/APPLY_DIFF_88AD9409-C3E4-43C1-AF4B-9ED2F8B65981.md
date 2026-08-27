# Apply diff — Agent 3
run_id: 88AD9409-C3E4-43C1-AF4B-9ED2F8B65981
timestamp: 2026-07-26T13:05:26Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Transportar `aiInsightId` no widget e vinculá-lo aos planos financeiro e pedagógico.

## Diff proposto
```diff
 AiChatWidget.tsx
+ aiInsightId em mensagens/respostas
+ aiInsightId no POST de actions/save
+ vínculo ao clicar nas acções do diagnóstico
```

## Risco
Baixo: usa validação tenant já existente no endpoint e não muda aprovação.

## Reversão
Um único `git revert`.
