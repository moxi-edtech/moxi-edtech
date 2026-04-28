# Fiscal Provider - Variáveis de Produção

Configurar no ambiente de produção (host/Vercel):

- `FISCAL_PROVIDER_NAME=kuantu`
- `FISCAL_PROVIDER_BASE_URL=https://api.kwanzar.ao/`
- `FISCAL_PROVIDER_API_KEY=<secret>`

Parâmetros opcionais:

- `FISCAL_PROVIDER_TIMEOUT_MS=8000`
- `FISCAL_PROVIDER_MAX_RETRIES=3`
- `FISCAL_PROVIDER_BACKOFF_MS=300`

## Observações
- Não versionar `FISCAL_PROVIDER_API_KEY` em arquivo `.env` do repositório.
- Após alterar variáveis de produção, realizar novo deploy para aplicar.
