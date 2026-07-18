# Aprovação necessária — Agent 3
run_id:    2F9768A5-707D-4546-AD40-2F09CD6EC1E7
timestamp: 2026-07-18T12:46:58Z

## Acção proposta
Reparar o índice UNIQUE particionado de frequências e corrigir o UPSERT ativo sem alterar a assinatura ou o retorno da RPC.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_2F9768A5-707D-4546-AD40-2F09CD6EC1E7.md
```

## Risco
Médio: cria sete índices UNIQUE em partições atualmente vazias e anexa-os ao índice pai; um erro de attachment aborta toda a transação.

## Como aprovar
Commit com mensagem: `APPROVE: 2F9768A5-707D-4546-AD40-2F09CD6EC1E7`

## Como rejeitar
Commit com mensagem: `REJECT: 2F9768A5-707D-4546-AD40-2F09CD6EC1E7 [motivo]`
