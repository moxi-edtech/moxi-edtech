**Types & Supabase**
- Single source of truth: `types/supabase.ts`.
- App imports types via `~types/*` alias (no `@types/*`).
- Paths config:
  - Root `tsconfig.json`: `"~types/*": ["types/*"]`
  - `apps/web/tsconfig.json`: `"~types/*": ["../../types/*"]`
- Regenerate DB types after migrations:
  - Apply migrations: `supabase db push --project-ref <project-ref>`
  - Generate: `npm run gen:types`
- Type checking and build:
  - `npm run typecheck` (TS only)
  - `npm run build` (Next.js production build)

**Views Tipadas**
- `public.Views` inclui: `escolas_view`, `matriculas_por_ano`, `pagamentos_status`.
- Definidas em `apps/web/supabase/migrations/20250916_create_views.sql`.
- Se não aparecerem ao gerar types, verifique se as migrations foram aplicadas no projeto Supabase.

**Import Examples**
- `import type { Database } from "~types/supabase"`
- `import type { ProfileRow, UserRole } from "~types/aliases"`
