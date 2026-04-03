# Execução Real — Matriz Mínima por Tipo Fiscal (V2)

timestamp_utc: 20260402T225730Z
base_url: https://app.klasse.ao
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
usuario_execucao: fiscal.e2e.ssr.v2.20260402t225730z@klasse.ao

## Probe
- compliance_http: 200

## Resultados
| Tipo | Prefixo | HTTP | Resultado | documento_id | numero_formatado | erro |
|---|---|---:|---|---|---|---|
| FT | FT | 201 | PASS | 9b2b9232-2dc1-4cf8-9dd0-f9220ee0ce0b | FT-000001 | n/a |
| FR | FR | 409 | FAIL | n/a | n/a | FISCAL_IDEMPOTENCY_CONFLICT |
| RC | RC | 201 | PASS | 50d89441-8067-44f2-b1eb-6bf6d441ecea | RC-000005 | n/a |
| ND | ND | 201 | PASS | 59a9da1d-8ef5-46b3-bf13-dffdee67a6d2 | ND-000002 | n/a |
| NC | NC | 201 | PASS | 7c4ffcbf-944e-47e5-ab46-1539b5be598a | NC-000002 | n/a |
| PP | PP | 201 | PASS | 9ecbbbe3-c453-4e3e-902a-f87537b45671 | PP-000002 | n/a |
| GR | GR | 201 | PASS | a1156fa1-6e89-4859-8a3c-e6c11bc7e8a9 | GR-000002 | n/a |
| GT | GT | 201 | PASS | 1242ace7-4903-4ba4-8ef0-1eb2d6c6f8dd | GT-000002 | n/a |
| FG | FG | 201 | PASS | 254bc991-2f3f-4d97-b956-4cea027e2a53 | FG-000002 | n/a |

## Export SAF-T
- periodo_inicio: 2026-04-01
- periodo_fim: 2026-04-30
- http_status: 409
- export_id: ed3f5fc6-4b5f-4e91-aef1-58cbdecd7717
- resposta:
```json
{"ok":false,"error":{"code":"FISCAL_SAFT_EXPORT_ALREADY_EXISTS","message":"Já existe exportação SAF-T(AO) para este período.","details":{"request_id":"ec04e489-0461-47ff-bf5e-97f04c2a407b","empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","export_id":"ed3f5fc6-4b5f-4e91-aef1-58cbdecd7717"}}}
```

## Poll Status
- tentativa_1: status=generated path=fiscal/saft/11a6aba6-3315-4732-a0b1-383202cf4f9d/2026-04-01_2026-04-30_490cdb72-5f6a-4c7d-b70a-6480e1f5e69f.xml

## Conclusão
- tipos_pass: 8
- tipos_fail: 1
