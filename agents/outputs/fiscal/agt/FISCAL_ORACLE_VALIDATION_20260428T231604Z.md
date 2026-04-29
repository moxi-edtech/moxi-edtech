# AGT Oracle Validation Evidence

timestamp_utc: 20260428T231604Z
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
| AGT_P06_DUAS_LINHAS_14_ISENTO | Linha 14% + linha isenta Mxx | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |
| AGT_P07_SETTLEMENT_100x055 | 100 x 0.55 com desconto linha 8.8% + global | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |
| AGT_P08_FX_USD | Documento em moeda estrangeira com cambio | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |
| AGT_P09_CONSUMIDOR_FINAL | Consumidor final (sem NIF) total pequeno | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |
| AGT_P11_GR_GT_MINIMO | Cenario base para guias GR/GT (motor/oraculo) | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |
| AGT_P14_FATURA_GLOBAL | Fatura global consolidada | 500 | FAIL (FISCAL_VALIDATION_FAILED) | n/a | n/a | n/a | n/a |

## Falhas

- AGT_P06_DUAS_LINHAS_14_ISENTO: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL
- AGT_P07_SETTLEMENT_100x055: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL
- AGT_P08_FX_USD: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL
- AGT_P09_CONSUMIDOR_FINAL: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL
- AGT_P11_GR_GT_MINIMO: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL
- AGT_P14_FATURA_GLOBAL: FISCAL_VALIDATION_FAILED - FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL

## Conclusao

Existem divergencias/falhas. Certificacao AGT permanece NO-GO ate saneamento total.