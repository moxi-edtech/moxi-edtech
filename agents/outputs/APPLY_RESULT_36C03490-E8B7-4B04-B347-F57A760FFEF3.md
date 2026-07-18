# Resultado do apply — DB lint, lote 2
run_id: 36C03490-E8B7-4B04-B347-F57A760FFEF3
approval_commit: fe68a7795a1ee14c41974039ac2f3e608798cbb8
status: PARTIAL

## Resultado

- `increment_documento_print`: PASS
- `get_classes_sem_preco`: PASS
- `create_and_provision_escola_from_onboarding`: PASS
- `upsert_frequencias_batch`: REVERTED
- `provisionar_escola_from_onboarding`: REVERTED

O lint revelou erros estruturais adicionais nas duas funções revertidas. A
constraint UNIQUE de `frequencias` tem índice pai inválido, e o provisionamento
ainda referencia `classes.activa`, inexistente no schema atual.

## Métrica

- Erros antes do lote: 61
- Erros depois do lote: 58
- Redução líquida: 3

