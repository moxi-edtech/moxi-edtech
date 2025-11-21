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

A URL do pooler deve ser exportada em **DB_URL**:

```bash
export DB_URL="postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
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
supabase db pull --db-url "$DB_URL"
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
