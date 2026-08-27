# Apply diff — Triagem: promoção individual completa

run_id: TRIAGEM-ATENDIMENTO-INDIVIDUAL-20260823

## Alteração proposta

Substituir o botão individual `Promover`, que chamava a transição académica direta, por `Concluir no atendimento`, que abre o Balcão incorporado. A promoção em massa permanece no rodapé da Triagem.

## Diff

```diff
- [Promover] → POST /api/secretaria/matriculas/transitar
- [Balcão]
+ [Concluir no atendimento] → Balcão contextual
```

## Risco e reversão

Não altera dados, API, schema ou regras do lote. Evita uma transição individual sem cobrança e é reversível com um único `git revert`.
