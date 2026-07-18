# Aprovação necessária — Agent 3
run_id:    6077067D-7A20-44B0-90BA-8AC34C7BC619
timestamp: 2026-07-18T12:48:57Z

## Acção proposta
Reparar o índice UNIQUE particionado através de constraints filhas e corrigir o UPSERT ativo sem alterar a assinatura ou retorno da RPC.

## Diff
```diff
Ver agents/outputs/APPLY_DIFF_6077067D-7A20-44B0-90BA-8AC34C7BC619.md
```

## Risco
Médio: cria sete constraints UNIQUE em partições vazias e anexa os seus índices ao pai; qualquer erro aborta a transação completa.

## Como aprovar
Commit com mensagem: `APPROVE: 6077067D-7A20-44B0-90BA-8AC34C7BC619`

## Como rejeitar
Commit com mensagem: `REJECT: 6077067D-7A20-44B0-90BA-8AC34C7BC619 [motivo]`
