# Apply Diff — Histórico de pagamentos humanizado

run_id: 2ECB3DFF-58CC-4125-BF64-3978E91340A6  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/components/financeiro/PagamentosListClient.tsx`

## Objetivo

Substituir a tabela técnica por um histórico operacional centrado em aluno, valor, propina, método e data.

## Diff proposto

```diff
- UUID, `settled`, `cash` e timestamp bruto como informação principal
+ resumo de quantidade e valor recebido
+ nome do aluno e propina como contexto principal
+ rótulos `Confirmado`, `Dinheiro`, `TPA`, `Transferência`, `Multicaixa`, `Kwik`
+ data e hora em português de Angola
+ identificador curto apenas como detalhe
+ cartões responsivos com reversão contextual
```

## Risco

Baixo. Mudança apenas de apresentação; a reversão mantém o endpoint e a confirmação existentes.

## Reversão

Restaurar a tabela anterior.
