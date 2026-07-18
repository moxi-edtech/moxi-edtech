# Resultado do apply — DB lint, lote 5 financeiro
run_id: 4E9DBA6C-2471-49FC-A4AC-86D2FAD8D872
approval_commit: b2aa04cd0ccc034ae362dd5975e7f74b86d54d86
status: PARTIAL

## Resultado

- `realizar_pagamento_balcao`: PASS
- `confirmar_conciliacao_transacao`: REVERTED

A conciliação revelou referência adicional à coluna removida `lancamento_id` em
`financeiro_transacoes_importadas`. O rollback seletivo foi concluído.

## Métrica

- Erros antes: 56
- Erros depois: 55
- Redução líquida: 1

