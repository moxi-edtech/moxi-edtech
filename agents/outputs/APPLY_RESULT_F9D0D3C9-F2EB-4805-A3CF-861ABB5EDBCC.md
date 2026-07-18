# Resultado do apply — DB lint, lote 1
run_id: F9D0D3C9-F2EB-4805-A3CF-861ABB5EDBCC
approval_commit: 72af7873f31b75cdb05c144228ff143545db5a18
status: PARTIAL

## Resultado

- `admin_recalc_all_aggregates`: PASS
- `claim_ai_usage_slot`: PASS
- `registrar_venda_avulsa`: PASS
- `increment_documento_print`: REVERTED

O lint revelou que `increment_documento_print` também referencia a coluna
inexistente `audit_logs.user_email`, fora do diff aprovado. A função foi
automaticamente revertida conforme o contrato.

## Métrica

- Erros antes: 64
- Erros depois: 61
- Redução líquida: 3

