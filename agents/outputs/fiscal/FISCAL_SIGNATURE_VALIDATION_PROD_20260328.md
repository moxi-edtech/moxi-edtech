# Fiscal Signature Validation Evidence

timestamp_utc: 20260329T002300Z  
ambiente: production  
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d  
serie_id: todas  
algorithm: RSASSA_PSS_SHA_256  
executado_por: Codex

## Comando

```bash
DB_URL='***' pnpm exec tsx tools/fiscal/verify-signature.ts \
  --empresa-id 11a6aba6-3315-4732-a0b1-383202cf4f9d \
  --algorithm RSASSA_PSS_SHA_256 \
  --limit 500 \
  --json
```

## Resumo

- status: PASS
- total_documentos: 7
- assinatura_ok: 7
- assinatura_fail: 0
- signature_nao_persistida: 0
- blockers: 0

## Certificacao — bloqueadores

- assinatura_base64 ausente: nao
- canonical_string ausente: nao
- chave publica ausente para key_version: nao

## Resultado por documento

| numero_formatado | key_version | status_documento | signature_ok | algorithm |
|---|---|---|---|---|
| FR-000001 | 1 | emitido | true | RSASSA_PSS_SHA_256 |
| FR-000002 | 1 | emitido | true | RSASSA_PSS_SHA_256 |
| FR-000003 | 1 | rectificado | true | RSASSA_PSS_SHA_256 |
| FR-000004 | 1 | anulado | true | RSASSA_PSS_SHA_256 |
| RC-000001 | 1 | emitido | true | RSASSA_PSS_SHA_256 |
| RC-000002 | 1 | emitido | true | RSASSA_PSS_SHA_256 |
| RC-000003 | 1 | emitido | true | RSASSA_PSS_SHA_256 |

## Conclusao

As assinaturas fiscais foram verificadas com sucesso para todos os documentos auditados em produção usando a chave pública da `key_version` correspondente.
