# Fiscal Hash Validation Evidence

timestamp_utc: 20260329T002300Z  
ambiente: production  
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d  
serie_id: todas  
executado_por: Codex

## Comando

```bash
DB_URL='***' pnpm exec tsx tools/fiscal/verify-hash-control.ts \
  --empresa-id 11a6aba6-3315-4732-a0b1-383202cf4f9d \
  --limit 500 \
  --json
```

## Resumo

- status: PASS
- total_documentos: 7
- hash_ok: 7
- hash_fail: 0
- canonical_ausente: 0

## Cobertura documental

- FT: 4
- RC: 3
- inclui status: `emitido`, `rectificado`, `anulado`

## Resultado por documento

| numero_formatado | serie_id | status | hash_ok |
|---|---|---|---|
| FR-000001 | 172c872d-dee2-41c5-bdbd-fa2ec328e869 | emitido | true |
| FR-000002 | 172c872d-dee2-41c5-bdbd-fa2ec328e869 | emitido | true |
| FR-000003 | 172c872d-dee2-41c5-bdbd-fa2ec328e869 | rectificado | true |
| FR-000004 | 172c872d-dee2-41c5-bdbd-fa2ec328e869 | anulado | true |
| RC-000001 | 248ed4cf-1e20-4f50-a63c-321cedae8525 | emitido | true |
| RC-000002 | 248ed4cf-1e20-4f50-a63c-321cedae8525 | emitido | true |
| RC-000003 | 248ed4cf-1e20-4f50-a63c-321cedae8525 | emitido | true |

## Conclusao

`hash_control` validado com sucesso para todos os documentos auditados em produção, usando `SHA-256(canonical_string)`.
