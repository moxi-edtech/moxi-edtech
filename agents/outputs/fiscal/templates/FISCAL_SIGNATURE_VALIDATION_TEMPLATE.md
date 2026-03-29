# Fiscal Signature Validation Evidence

timestamp_utc: <YYYYMMDDTHHMMSSZ>  
ambiente: <local|staging|production>  
empresa_id: <uuid>  
serie_id: <uuid|null>  
algorithm: <ex: RSASSA_PSS_SHA_256>  
executado_por: <nome/email>

## Comando

```bash
DB_URL='***' pnpm tsx tools/fiscal/verify-signature.ts \
  --empresa-id <empresa_uuid> \
  --serie-id <serie_uuid> \
  --algorithm RSASSA_PSS_SHA_256 \
  --limit 200 \
  --json
```

## Resumo

- status: <PASS|FAIL>
- total_documentos: <n>
- assinatura_ok: <n>
- assinatura_fail: <n>
- signature_nao_persistida: <n>
- blockers: <n>

## Certificacao — bloqueadores

- assinatura_base64 ausente: <sim|nao>
- canonical_string ausente: <sim|nao>
- chave publica ausente para key_version: <sim|nao>

## Achados (se houver)

| documento_id | numero_formatado | key_version | status_documento | detalhe |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## Conclusao

<texto objetivo sobre validade criptografica das assinaturas>
