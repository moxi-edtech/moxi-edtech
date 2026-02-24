# KLASSE Validator

## Uso rápido

```bash
bash tools/validator/setup-validator.sh
./validate.sh
```

## O que o setup faz

- Gera `.env.validator` (se ainda não existir).
- Verifica dependências e cria `validate.sh`.
- Configura `.gitignore` para arquivos de output.

## Outputs

- `MONOREPO_VALIDATION_REPORT.md` — relatório humano.
- `REPORT_SCAN_LIVE.json` — relatório JSON para ferramentas.
