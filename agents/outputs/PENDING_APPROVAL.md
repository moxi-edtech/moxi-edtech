# Aprovação necessária — Agent 3
run_id:    36C03490-E8B7-4B04-B347-F57A760FFEF3
timestamp: 2026-07-18T12:39:57Z

## Acção proposta
Criar o segundo lote de correções do DB lint em cinco RPCs ativas, alinhando-as ao schema real sem alterar assinaturas, retornos ou autorização.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_36C03490-E8B7-4B04-B347-F57A760FFEF3.md
```

## Risco
Baixo a médio: as mudanças alinham referências ao schema vigente, mas afetam reimpressão, frequência, pricing e provisionamento; todas serão validadas individualmente pelo lint.

## Como aprovar
Commit com mensagem: `APPROVE: 36C03490-E8B7-4B04-B347-F57A760FFEF3`

## Como rejeitar
Commit com mensagem: `REJECT: 36C03490-E8B7-4B04-B347-F57A760FFEF3 [motivo]`
