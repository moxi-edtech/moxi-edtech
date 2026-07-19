# Apply result — Agent 3
run_id:          9528F6E6-93AF-456D-9DBB-84C4DF9BBC57
approval_commit: 55fbb846fa3ebc6d1992d4f4462a45195e81096a
status:          FAIL_REVERTED

## Resultado

Os seis `REVOKE ... FROM anon` executaram sem erro, mas a verificação pós-apply encontrou `anon_execute = 6` porque todas as funções também concedem `EXECUTE` a `PUBLIC`.

## Reversão automática

- Restaurados os seis grants directos de `anon` numa transacção com exit 0.
- Removida a migration local falhada.
- Estado anterior restaurado.

## Causa

O grant herdado de `PUBLIC` mantém `has_function_privilege('anon', ..., 'EXECUTE') = true`; a correção precisa revogar `PUBLIC` e `anon` conjuntamente.
