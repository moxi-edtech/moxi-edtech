# Execução Real — Matriz Mínima por Tipo Fiscal

timestamp_utc: 20260402T224932Z
base_url: https://app.klasse.ao
escola_id: f406f5a7-a077-431c-b118-297224925726
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
usuario_execucao: fiscal.e2e.20260402t224932z@klasse.ao

## Resultados
| Tipo | Prefixo | HTTP | Resultado | documento_id | numero_formatado | erro |
|---|---|---:|---|---|---|---|
| FT | FR | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| FR | FR | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| RC | RC | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| ND | ND | n/a | FAIL | n/a | n/a | FT base não gerada |
| NC | NC | n/a | FAIL | n/a | n/a | FT base não gerada |
| PP | PP | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| GR | GR | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| GT | GT | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |
| FG | FG | 401 | FAIL | n/a | n/a | UNAUTHENTICATED |

## Export SAF-T
- periodo_inicio: 2026-04-01
- periodo_fim: 2026-04-30
- http_status: 401
- export_id: n/a
- resposta:
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"5ee1486c-2d4f-44f9-8adc-42e62779f6fc"}}}
```

## Conclusão
- tipos_pass: 0
- tipos_fail: 9
