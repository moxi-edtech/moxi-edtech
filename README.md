**Types & Supabase**
- Single source of truth: `types/supabase.ts`.
- App imports types via `~types/*` alias (no `@types/*`).
- Paths config:
  - Root `tsconfig.json`: `"~types/*": ["types/*"]`
  - `apps/web/tsconfig.json`: `"~types/*": ["../../../types/*"]` (porque `baseUrl` é `src`)
  - App-specific alias `@/*` fica definido apenas em `apps/web/tsconfig.json`.
- Regenerate DB types after migrations:
  - Apply migrations: `supabase db push --project-ref wjtifcpxxxotsbmvbgoq`
  - Generate: `npm run gen:types`
- Type checking and build:
  - `npm run typecheck` (TS only)
  - `npm run build` (Next.js production build)

**Migrations unificadas (fonte única)**
- Todas as migrations agora vivem em `supabase/migrations/` (via Supabase CLI).
- Seeds em `supabase/seeds/` e testes SQL (ex.: RLS) em `supabase/tests/`.
- O diretório antigo `db/` foi descontinuado (README aponta para `supabase/`).
- Para aplicar no projeto remoto: `supabase db push --project-ref wjtifcpxxxotsbmvbgoq`.

**Seeds & Resets**
- Local: `supabase db reset` executa `supabase/seed.sql` (que inclui os arquivos de `supabase/seeds/`).
- Remoto: `npm run db:seed:remote` concatena `supabase/seeds/*.sql` e executa via CLI.
- Tabela de vínculo escola-usuário padronizada: `public.escola_usuarios` (coluna `papel` com check).

**Views Tipadas**
- `public.Views` inclui: `escolas_view`, `matriculas_por_ano`, `pagamentos_status`.
- Definidas em `supabase/migrations/20250916_create_views.sql` (monorepo raiz).
- Se não aparecerem ao gerar types, verifique se as migrations foram aplicadas no projeto Supabase.

**Import Examples**
- `import type { Database } from "~types/supabase"`
- `import type { ProfileRow, UserRole } from "~types/aliases"`

**DB Migration: numero_login as TEXT**
- Migration SQL no repo: `docs/db/2025-09-26-numero_login-text.sql`.
- Objetivo: garantir que `public.profiles.numero_login` seja `TEXT` (aceita prefixo alfanumérico) e criar índice único opcional por escola.
- Como aplicar:
  - Abrir Supabase Dashboard → SQL Editor.
  - Colar e executar o conteúdo do arquivo acima.
  - Depois, regenere os types: `npm run gen:types`.
