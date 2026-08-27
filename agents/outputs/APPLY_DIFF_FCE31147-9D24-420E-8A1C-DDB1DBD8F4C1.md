# Apply diff — Agent 3
run_id: FCE31147-9D24-420E-8A1C-DDB1DBD8F4C1
timestamp: 2026-07-26T13:03:02Z

## P0_CHECKLIST
Todos os itens estão marcados como concluídos.

## Acção
Persistir respostas de dados como insights idempotentes e devolver o ID de origem ao widget.

## Diff proposto
```diff
 api/admin/ai/assistant/route.ts
+ fingerprint diário por ferramenta e consulta
+ upsert em ai_insights após resposta data_query
+ aiInsightId na resposta
```

## Risco
Médio controlado: cria memória operacional na tabela existente, com RLS e idempotência; não altera dados académicos ou financeiros.

## Reversão
Um único `git revert`.
