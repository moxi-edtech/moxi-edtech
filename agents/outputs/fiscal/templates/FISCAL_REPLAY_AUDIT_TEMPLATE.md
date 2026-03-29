# Fiscal Replay Audit Evidence

timestamp_utc: <YYYYMMDDTHHMMSSZ>  
ambiente: <local|staging|production>  
empresa_id: <uuid>  
serie_id: <uuid|null>  
periodo: <YYYY-MM-DD..YYYY-MM-DD|null>  
executado_por: <nome/email>

## Comando

```bash
DB_URL='***' pnpm tsx tools/fiscal/replay-audit.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --date-from <YYYY-MM-DD> \
  --date-to <YYYY-MM-DD> \
  --algorithm RSASSA_PSS_SHA_256 \
  --json
```

## Resumo

- status: <PASS|FAIL>
- total_documentos: <n>
- total_issues: <n>
- total_blockers: <n>

## Verificacoes executadas

- hash_control = SHA-256(canonical_string)
- encadeamento por serie (hash_anterior)
- assinatura criptografica por key_version
- evento EMITIDO em fiscal_documentos_eventos

## Issues (se houver)

| blocker | code | serie_id | numero_formatado | documento_id | detalhe |
|---|---|---|---|---|---|
| true/false | ... | ... | ... | ... | ... |

## Conclusao

<texto objetivo sobre integridade da cadeia fiscal>
