# Apply Diff — School Operating Profile Foundation

run_id:    3A89E6EF-A429-4D2D-ACEF-BFD9CE7EBD6A
timestamp: 2026-08-21

## Ação proposta

Adicionar a fundação backend do perfil operacional por escola, limitada aos setores `private` e `public`, com defaults privados e capabilities server-side.

## Ficheiros previstos

- `supabase/migrations/20260821140000_school_operating_profile_foundation.sql`
- `apps/web/src/lib/school-profile/types.ts`
- `apps/web/src/lib/school-profile/resolve-school-profile.ts`
- `apps/web/src/lib/school-profile/finance-capabilities.ts`
- `apps/web/src/lib/school-profile/assessment-capabilities.ts`
- `apps/web/src/lib/school-profile/document-capabilities.ts`
- `apps/web/src/lib/school-profile/guards.ts`
- `apps/web/src/app/api/financeiro/mensalidades/gerar/route.ts`
- `apps/web/src/app/api/admin/ai/finance-message/route.ts`

## Risco

Baixo: adiciona uma tabela nova, mantém fallback explícito para `private/tuition/custom` quando não houver perfil e apenas bloqueia fluxos incompatíveis depois de resolver o perfil server-side.

Não aplica a migration diretamente no banco nesta etapa.

## Resultado

Aplicado no repo. `pnpm -C apps/web typecheck` passou. A migration permanece não aplicada no banco live.

## Reversão

Reverter o commit desta alteração. A migration não será executada contra o banco live pelo agente.
