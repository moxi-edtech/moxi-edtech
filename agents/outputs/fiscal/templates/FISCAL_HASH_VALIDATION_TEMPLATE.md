# Fiscal Hash Validation Evidence

timestamp_utc: <YYYYMMDDTHHMMSSZ>  
ambiente: <local|staging|production>  
empresa_id: <uuid>  
serie_id: <uuid|null>  
executado_por: <nome/email>

## Comando

```bash
DB_URL='***' pnpm tsx tools/fiscal/verify-hash-control.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --limit 500 \
  --json
```

## Resumo

- status: <PASS|FAIL>
- total_documentos: <n>
- hash_ok: <n>
- hash_fail: <n>
- canonical_ausente: <n>

## Achados (se houver)

| documento_id | numero_formatado | serie_id | hash_atual | hash_esperado | detalhe |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

## Conclusao

<texto objetivo sobre conformidade de hash_control>
