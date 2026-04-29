# AGT Oracle Validation Evidence

timestamp_utc: 20260428T224621Z
ambiente: external_oracle_validation
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
total_scenarios: 6
status: FAIL

## Resumo

- pass: 0
- fail: 6
- regra divergencia: FAIL HARD quando != 0.0000

## Resultado por cenario

| cenario | descricao | http | status | snapshot_id | provider_doc | total_klasse | total_oracle |
|---|---|---:|---|---|---|---:|---:|
| AGT_P06_DUAS_LINHAS_14_ISENTO | Linha 14% + linha isenta Mxx | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |
| AGT_P07_SETTLEMENT_100x055 | 100 x 0.55 com desconto linha 8.8% + global | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |
| AGT_P08_FX_USD | Documento em moeda estrangeira com cambio | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |
| AGT_P09_CONSUMIDOR_FINAL | Consumidor final (sem NIF) total pequeno | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |
| AGT_P11_GR_GT_MINIMO | Cenario base para guias GR/GT (motor/oraculo) | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |
| AGT_P14_FATURA_GLOBAL | Fatura global consolidada | 200 | FAIL (UNKNOWN) | n/a | n/a | n/a | n/a |

## Falhas

- AGT_P06_DUAS_LINHAS_14_ISENTO: UNKNOWN - sem detalhe
- AGT_P07_SETTLEMENT_100x055: UNKNOWN - sem detalhe
- AGT_P08_FX_USD: UNKNOWN - sem detalhe
- AGT_P09_CONSUMIDOR_FINAL: UNKNOWN - sem detalhe
- AGT_P11_GR_GT_MINIMO: UNKNOWN - sem detalhe
- AGT_P14_FATURA_GLOBAL: UNKNOWN - sem detalhe

## Conclusao

Existem divergencias/falhas. Certificacao AGT permanece NO-GO ate saneamento total.