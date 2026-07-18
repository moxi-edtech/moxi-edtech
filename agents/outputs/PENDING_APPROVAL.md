# Aprovação necessária — Agent 3
run_id:    79DF0695-8666-461E-B4E1-1887CF8D9D48
timestamp: 2026-07-18T12:56:54Z

## Acção proposta
Corrigir integralmente a RPC de confirmação de conciliação, preservando o vínculo do lançamento em JSON após remoção da coluna legada.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_79DF0695-8666-461E-B4E1-1887CF8D9D48.md
```

## Risco
Médio: altera enums financeiros e move o vínculo do lançamento para metadados JSON já existentes; tudo ocorre numa transação.

## Como aprovar
Commit com mensagem: `APPROVE: 79DF0695-8666-461E-B4E1-1887CF8D9D48`

## Como rejeitar
Commit com mensagem: `REJECT: 79DF0695-8666-461E-B4E1-1887CF8D9D48 [motivo]`
