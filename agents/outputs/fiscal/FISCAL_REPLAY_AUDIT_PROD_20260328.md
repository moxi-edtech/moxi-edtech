# Fiscal Replay Audit Evidence

timestamp_utc: 20260329T002300Z  
ambiente: production  
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d  
serie_id: todas  
periodo: 2026-03-01..2026-03-31  
executado_por: Codex

## Comando

```bash
DB_URL='***' pnpm exec tsx tools/fiscal/replay-audit.ts \
  --empresa-id 11a6aba6-3315-4732-a0b1-383202cf4f9d \
  --date-from 2026-03-01 \
  --date-to 2026-03-31 \
  --algorithm RSASSA_PSS_SHA_256 \
  --json
```

## Resumo

- status: PASS
- total_documentos: 7
- total_issues: 0
- total_blockers: 0

## Verificacoes executadas

- hash_control = SHA-256(canonical_string)
- encadeamento por serie (hash_anterior)
- assinatura criptografica por key_version
- evento EMITIDO em fiscal_documentos_eventos

## Cobertura documental

| numero_formatado | tipo_documento | status | key_version |
|---|---|---|---|
| FR-000001 | FT | emitido | 1 |
| RC-000001 | RC | emitido | 1 |
| RC-000002 | RC | emitido | 1 |
| FR-000002 | FT | emitido | 1 |
| FR-000003 | FT | rectificado | 1 |
| RC-000003 | RC | emitido | 1 |
| FR-000004 | FT | anulado | 1 |

## Conclusao

Replay audit concluido sem desvios: cadeia fiscal, integridade de hash, assinatura e eventos de emissao estao consistentes para o período auditado em produção.
