# README-db.md — Moxi EdTech (Banco de Dados)

## 📌 Visão Geral

O Moxi EdTech usa **Supabase Postgres 17** como banco principal, com:

- Gerenciamento via **Supabase CLI**
- Acesso remoto através do **Connection Pooler**
- Migrations **totalmente versionadas**
- Geração automática de tipos TypeScript
- Sem uso do ambiente Docker local do Supabase

Este documento descreve **como trabalhar corretamente com o banco**, evitando drift, conflitos e perdas de schema.

---

# ⚙️ **1. Conexão com o banco remoto**

A URL do pooler deve ser exportada em **DB_URL** (use placeholders e mantenha fora do versionamento, via `.env.db`):

```bash
# Preferencial: Transaction Pooler (porta 6543)
export DB_URL="postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?sslmode=require"

# Alternativa: Session Pooler (porta 5432)
# export DB_URL="postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Dica: copie .env.db.example para .env.db e preencha DB_URL
# cp .env.db.example .env.db && $EDITOR .env.db
```

> ⚠️ **Importante:** Sempre use a URL do pooler, nunca a URL direta (`db.`).  
> Evita timeouts, limitações, e é 100% compatível com o CLI.

---

# 📦 **2. Gerando migrations**

Use sempre:

```bash
supabase db diff --db-url "$DB_URL" -f nome_da_migration
```

Exemplos:

```bash
supabase db diff --db-url "$DB_URL" -f create_financeiro
supabase db diff --db-url "$DB_URL" -f add_campo_novo
supabase db diff --db-url "$DB_URL" -f fix_policies
```

Isso vai gerar:

```
supabase/migrations/2025xxxxxx_create_financeiro.sql
```

---

# 🚀 **3. Aplicando migrations no banco remoto**

```bash
supabase db push --db-url "$DB_URL"
```

Com seed:

```bash
supabase db push --db-url "$DB_URL" --include-seed
```

---

# 🔄 **4. Puxando o schema remoto (db pull)**

Quando precisar atualizar o schema local para refletir o banco real:

```bash
# Usa o DB_URL do pooler; se estiver em session mode e saturado, troque para 6543 (transaction)
supabase db pull --db-url "$DB_URL"

# ou use o script que carrega .env.db automaticamente e desativa serviços durante o pull
npm run db:pull:remote
```

Isso gera um arquivo grande:

```
supabase/.branches/[ref]/schema.sql
```

E **não cria migrations automaticamente**.  
Ele apenas sincroniza o snapshot.

---

# 🧼 **5. Reset local (não obrigatório)**

Se algum dia você usar banco local:

```bash
supabase start
supabase db reset
```

> ⚠️ **Com seu config atual, supabase start está desligado.**

---

# 🧬 **6. Gerar tipos TypeScript atualizados**

Comando padrão do monorepo:

```bash
pnpm gen:types
```

Ou manualmente:

```bash
supabase gen types typescript --project-id <project-ref> > types/supabase.ts
```

---

# 🛡️ **7. RLS — Testes**

```bash
pnpm test:rls
```

---

# 📚 **8. Estrutura de pastas**

```
supabase/
  ├── migrations/
  ├── tests/
  ├── .branches/
  ├── config.toml
  └── seed.sql
```

---

# 🔥 **9. Boas práticas**

- Nunca edite migrations antigas.
- Sempre gere migrations via `db diff`.
- Sempre gere os TS Types depois de push.
- Teste RLS manualmente via SQL.

---

# 🔄 **10. Fluxo de trabalho oficial**

### Criar algo novo:
```bash
ALTER TABLE...
supabase db diff --db-url "$DB_URL" -f nome
supabase db push --db-url "$DB_URL"
pnpm gen:types
```

### Resolver drift:
```bash
supabase db pull --db-url "$DB_URL"
```

### Desalinhamento de histórico (reparo)
```bash
# 1) Se aparecer "Remote migration versions not found...", liste as versões faltantes
supabase migration list --db-url "$DB_URL"

# 2) Marque como reverted as versões que não existem localmente (exemplo real usado):
supabase migration repair --db-url "$DB_URL" --status reverted $(cat tmp/missing_versions.txt)

# 3) Marque a baseline atual como aplicada (se precisar)
supabase migration repair --db-url "$DB_URL" --status applied 20251231163837

# 4) Use sempre a porta 5432 no CLI para evitar o erro de prepared statement duplicado do pooler 6543
export DB_URL="postgresql://...@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
supabase db push --db-url "$DB_URL"
supabase db pull --db-url "$DB_URL"
```

Notas:
- A baseline atual é `supabase/migrations/20251231163837_baseline.sql` (idempotente, com CREATE SCHEMA IF NOT EXISTS + extensões `uuid-ossp`, `pg_trgm`, `pgcrypto`).
- `supabase db pull` agora gera `20251231200952_remote_schema.sql` e marca como aplicada; o histórico remoto está limpo.
- Se aparecer um migration `remote_schema` quebrado, reverta com `supabase migration repair --status reverted <id>` e remova o arquivo local correspondente.

### Testar:
```bash
pnpm test:rls
```

---

Fim.

---

# 🧾 **11. Log de operações**

- 2025-11-21 — Pull do schema remoto via pooler:
  - Snapshot salvo em `supabase/.branches/remote/schema.sql`.
  - Observação: `supabase db pull` apresentou erro do stack Realtime; foi utilizado `pg_dump` do Postgres 17 via Docker para extrair somente o schema.
  - Types atualizados com `pnpm gen:types` em `types/supabase.ts`.

---

# 🧰 **12. Remoto → Local com dados (pg_dump/psql)**

Em casos onde você precisa espelhar o banco remoto no local com dados (e não apenas schema), use `pg_dump` (Postgres 17) e restaure no Postgres local do Supabase.

Pré‑requisitos
- Supabase CLI instalado e login feito: `supabase login`
- Docker Desktop (apenas para rodar o Supabase local) OU Postgres local
- Cliente Postgres 17 disponível (duas opções):
  - Homebrew: `brew install postgresql@17 && export PATH="/usr/local/opt/postgresql@17/bin:$PATH"`, ou
  - Docker (alternativa ao cliente local): usar imagem `postgres:17` só para o dump.

1) Exportar a URL do pooler remoto
```bash
export DB_URL="postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
```

2) Gerar o dump somente de `public` e `graphql_public`
- Com cliente local 17:
```bash
mkdir -p tmp
pg_dump "$DB_URL" \
  --no-owner --no-privileges \
  --schema=public --schema=graphql_public \
  -f tmp/remote_public.sql
```

- Alternativa via Docker (sem instalar cliente):
```bash
docker run --rm -v "$PWD:/work" postgres:17 \
  pg_dump "$DB_URL" \
    --no-owner --no-privileges \
    --schema=public --schema=graphql_public \
    -f /work/tmp/remote_public.sql
```

- Atalho via NPM scripts:
```bash
npm run db:dump:remote    # usa scripts/db-dump-remote.sh (usa DB_URL e SCHEMAS)
npm run db:dump:remote:schema-only   # dump apenas do schema (sem dados)
npm run db:dump:remote:public        # dump só do schema 'public'
npm run db:dump:remote:all           # dump de todos os schemas (evite em Supabase)
```

3) Subir o Supabase local (Postgres na porta 54322)
```bash
supabase start
```

4) Restaurar no banco local
```bash
export LOCAL_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Opcional: recriar apenas o schema public
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

# Importar o dump (se aparecer aviso de 'graphql_public already exists', pode ignorar)
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -f tmp/remote_public.sql
```

- Atalho via NPM scripts:
```bash
npm run db:restore:local  # usa scripts/db-restore-local.sh [dump.sql]
```

5) Regenerar tipos TypeScript
```bash
pnpm gen:types
```

Observações
- Preferimos copiar apenas `public` e `graphql_public`. Evite sobrescrever schemas internos do Supabase.
- O erro `schema "graphql_public" already exists` durante a restauração é esperado no ambiente local; a importação prossegue normalmente.
- Se precisar copiar somente o schema (sem dados), acrescente `--schema-only` ao `pg_dump`.
- Os scripts aceitam `SCHEMAS` (ex.: `SCHEMAS=public,graphql_public`) e `SCHEMA_ONLY=1` como variáveis de ambiente.

---

# 🔁 **13. Resumo – Pull vs Push**

- Pull (remoto → repo/local, apenas schema)
  - `export DB_URL="...pooler..."`
  - `supabase db pull --db-url "$DB_URL"`
  - `supabase start && supabase db reset --yes`
  - `pnpm gen:types`

- Pull com dados (remoto → local, schema + dados)
  - `npm run db:dump:remote` (gera tmp/remote_public_YYYYmmdd_HHMMSS.sql)
  - `supabase start`
  - `npm run db:restore:local` (ou passe o caminho do dump)
  - `pnpm gen:types`

- Push (repo/local → remoto, via migrations)
  - Faça as alterações (DDL) localmente
  - `supabase db diff --db-url "$DB_URL" -f nome_da_migration`
  - `supabase db push --db-url "$DB_URL"`
  - `pnpm gen:types`
