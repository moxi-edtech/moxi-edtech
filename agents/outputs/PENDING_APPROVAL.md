# Aprovação necessária — Agent 3
run_id:    6B94412A-DB3B-4A9D-BA75-581DDE319640
timestamp: 2026-07-18T12:51:51Z

## Acção proposta
Corrigir três RPCs financeiras para usar casts e valores canónicos dos enums atuais, sem alterar assinaturas ou retornos.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_6B94412A-DB3B-4A9D-BA75-581DDE319640.md
```

## Risco
Médio: altera classificação de origem e método em lançamentos financeiros conciliados; valores foram mapeados para os enums canónicos vigentes.

## Como aprovar
Commit com mensagem: `APPROVE: 6B94412A-DB3B-4A9D-BA75-581DDE319640`

## Como rejeitar
Commit com mensagem: `REJECT: 6B94412A-DB3B-4A9D-BA75-581DDE319640 [motivo]`
