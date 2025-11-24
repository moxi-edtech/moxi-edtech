# Contributing — Moxi EdTech

Bem-vindo! Este guia resume como trabalhar de forma consistente com banco, migrations e tipos TS no monorepo.

## Pré-requisitos
- Node 18+ e pnpm.
- Supabase CLI via `npx` (os scripts já usam `npx supabase@latest`).
- Variável `DB_URL` apontando para o pooler remoto:

```
export DB_URL="postgresql://<user>:<password>@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
```

O valor recomendado está no README-db.md.

## Fluxo do dia a dia (DB + Types)
- Aplicar migrations no remoto: `pnpm db:push`
- Conferir histórico local vs remoto: `pnpm db:list`
- Gerar tipos e validar TypeScript: `pnpm gen:types:verify`
- Opcional (snapshot do schema no repo): `pnpm db:pull` (requer Docker; cria shadow DB)

Observação: Todos os scripts usam `npx -y supabase@latest` para padronizar a versão do CLI entre devs.

## Geração de tipos
- Normalmente, após `db:push` rode `pnpm gen:types:verify` para atualizar `types/supabase.ts` e executar `tsc`.
- Para gerar explicitamente do remoto: `pnpm gen:types:remote`
- Se precisar gerar localmente: `pnpm db:pull` antes e então `pnpm gen:types:local`

## Aliases TypeScript
- O alias `~types/*` aponta para `types/*` no monorepo e `../../types/*` no app web.
- Abra o workspace de `apps/web` no editor para o TS resolver corretamente os paths.

## Troubleshooting comum
- Divergência Local vs Remote nas migrations: aplique as faltantes com `pnpm db:push` e rode `pnpm db:list` novamente.
- `db:pull` falhando por container: execute em um ambiente com Docker.
- Erros de coluna inexistente em políticas/índices: ajuste a migration para refletir o schema real (ex.: derive a escola via `profiles` em vez de `alunos.escola_id` se essa coluna não existir).

## Padrão RLS (alunos)
- Relacione a escola do aluno via `profiles`, usando `alunos.profile_id`.
- Predicate exemplo:

```
p.escola_id = (
  SELECT px.escola_id FROM public.profiles px
  WHERE px.user_id = public.alunos.profile_id
)
```

## Referências
- README-db.md → seção “12. Sincronização & Tipos (guia rápido)”
- Scripts em `package.json`: `db:*`, `gen:types*`, `gen:types:verify`

