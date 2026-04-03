# Execução Real — Matriz Mínima por Tipo Fiscal

timestamp_utc: 20260402T225502Z
base_url: https://app.klasse.ao
escola_id: f406f5a7-a077-431c-b118-297224925726
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
usuario_execucao: fiscal.e2e.ssr.20260402t225502z@klasse.ao

## Probe
- compliance_http: 200

## Resultados
| Tipo | Prefixo | HTTP | Resultado | documento_id | numero_formatado | erro |
|---|---|---:|---|---|---|---|
| FT | FR | 201 | PASS | 7e7e2dec-1a9d-434f-b071-7f577a3896aa | FR-000005 | n/a |
| FR | FR | 409 | FAIL | n/a | n/a | FISCAL_IDEMPOTENCY_CONFLICT |
| RC | RC | 201 | PASS | c48590cf-f437-4bdf-8e3b-5aedb99e7ae7 | RC-000004 | n/a |
| ND | ND | 201 | PASS | 23252f24-3e64-4361-bf2a-f01295645de8 | ND-000001 | n/a |
| NC | NC | 201 | PASS | af6b3c7d-bd6c-4b81-b3b4-8533d6a00eb3 | NC-000001 | n/a |
| PP | PP | 201 | PASS | cd956f49-f503-4872-a9af-11cd540d948a | PP-000001 | n/a |
| GR | GR | 201 | PASS | 38fe0d59-887f-403d-9d0d-cd58bd7413f8 | GR-000001 | n/a |
| GT | GT | 201 | PASS | 593f617e-df26-4e50-86a4-31738e6632ba | GT-000001 | n/a |
| FG | FG | 201 | PASS | d173350e-1566-4ea2-b013-1f9ea0f1b641 | FG-000001 | n/a |

## Export SAF-T
- periodo_inicio: 2026-04-01
- periodo_fim: 2026-04-30
- http_status: 409
- export_id: ed3f5fc6-4b5f-4e91-aef1-58cbdecd7717
- resposta:
```json
{"ok":false,"error":{"code":"FISCAL_SAFT_EXPORT_ALREADY_EXISTS","message":"Já existe exportação SAF-T(AO) para este período.","details":{"request_id":"90f76ee4-301f-4e08-a70e-782ebb838748","empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","export_id":"ed3f5fc6-4b5f-4e91-aef1-58cbdecd7717"}}}
```

## Poll Status
- tentativa_1: status=generated path=fiscal/saft/11a6aba6-3315-4732-a0b1-383202cf4f9d/2026-04-01_2026-04-30_490cdb72-5f6a-4c7d-b70a-6480e1f5e69f.xml

## Conclusão
- tipos_pass: 8
- tipos_fail: 1
