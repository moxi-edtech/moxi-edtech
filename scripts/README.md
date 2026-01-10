# Scripts de banco (Supabase)

Principais utilitários neste diretório:

- `supabase-pull-remote.sh` — desabilita serviços conflitantes, roda `supabase db pull` com os schemas definidos (padrão: `public,graphql_public`). Use via `pnpm run db:pull:remote`.
- `db-dump-remote.sh` — gera dump do remoto (usa `DB_URL`, pode setar `SCHEMAS` ou `SCHEMA_ONLY=1`). Alvo padrão: `tmp/remote_public_<timestamp>.sql`.
- `db-restore-local.sh` — restaura um dump SQL no Postgres local do Supabase (porta 54322).
- `db-select-remote.sh` — executa SELECT no remoto (carrega `DB_URL` de `.env.db` se existir).
- `db-select-local.sh` — executa SELECT no Postgres local (porta 54322, pode sobrescrever `LOCAL_URL`).

Fluxo rápido para desalinhamento de histórico de migrations (caso o pull/push acuse versões faltantes):

```bash
# Defina DB_URL usando o pooler na porta 5432 para o CLI
export DB_URL="postgresql://<user>:<pass>@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Liste o histórico remoto
supabase migration list --db-url "$DB_URL"

# Marque versões remotas que não existem localmente como reverted
# (adicione os IDs em tmp/missing_versions.txt antes de rodar)
cat tmp/missing_versions.txt
supabase migration repair --db-url "$DB_URL" --status reverted $(cat tmp/missing_versions.txt)

# Marque a baseline atual como aplicada, se necessário
supabase migration repair --db-url "$DB_URL" --status applied 20251231163837

# Refaça pull/push
supabase db push --db-url "$DB_URL"
supabase db pull --db-url "$DB_URL"
```

Observações:
- A baseline vigente é `supabase/migrations/20251231163837_baseline.sql` (idempotente, com extensões `uuid-ossp`, `pg_trgm`, `pgcrypto`).
- Se surgir um `remote_schema` quebrado, reverta o ID (`supabase migration repair --status reverted <id>`) e remova o arquivo local correspondente antes de novo `db pull`.
