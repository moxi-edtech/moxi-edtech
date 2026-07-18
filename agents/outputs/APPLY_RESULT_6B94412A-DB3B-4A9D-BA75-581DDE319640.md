# Resultado do apply — DB lint, lote 4 financeiro
run_id: 6B94412A-DB3B-4A9D-BA75-581DDE319640
approval_commit: ec64b73ca7ff77f7dcb29ad44f60a6d45daced34
status: PARTIAL

## Resultado

- `aprovar_fecho_caixa`: PASS
- `realizar_pagamento_balcao`: REVERTED
- `confirmar_conciliacao_transacao`: REVERTED

As duas RPCs revertidas revelaram erros adicionais após o primeiro cast. O
rollback seletivo foi aplicado e apenas a correção validada permaneceu.

## Métrica

- Erros antes: 57
- Erros depois: 56
- Redução líquida: 1

