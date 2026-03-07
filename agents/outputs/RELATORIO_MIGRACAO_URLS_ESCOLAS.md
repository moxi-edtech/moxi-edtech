# Relatório — Migração de URLs de Escola (Slug no path)

Data: 2026-03-06

## Resumo
- Implementada a base para `/escola/{slug}` mantendo compatibilidade com UUID via redirect.
- Backfill automático de slugs em `escolas` com deduplicação e trigger para novos registros.
- Middleware faz rewrite de slug → UUID e redirect de UUID → slug (302).

## Migrations aplicadas
- `supabase/migrations/20260328000000_escolas_slug.sql`
  - Adiciona coluna `slug` em `escolas` (NOT NULL + UNIQUE)
  - Funções `slugify_escola_nome`, `generate_escola_slug`
  - Backfill automático e trigger `trg_escolas_slug`

## Backend/Next
- `apps/web/src/middleware.ts`
  - Resolve `{slug|uuid}` para `escola_id`
  - Rewrite para `/escola/{uuid}` e `/api/escola/{uuid}`
  - Redirect 302 de UUID legado → slug
- `apps/web/src/lib/tenant/resolveEscolaIdForUser.ts`
  - Aceita slug ou UUID, com resolução via `escolas.slug`
- `apps/web/src/lib/tenant/resolveEscolaParam.ts`
  - Camada única de resolução `slug ↔ id`
- `apps/web/src/lib/tenant/escolaSlug.ts`
  - Utilitários `isEscolaUuid` e normalização
- `apps/web/src/hooks/useEscolaId.ts`
  - Resolve `escolaSlug` no client para links
- `apps/web/src/components/layout/klasse/AppShell.tsx`
  - Preferência por slug na geração de links
- `apps/web/src/app/secretaria/client-layout.tsx`
  - Redirects usam slug quando disponível
- `apps/web/src/app/escola/[id]/page.tsx`
  - Redirects primários usam slug
- `apps/web/src/app/escola/[id]/onboarding/page.tsx`
  - Redirects de onboarding usam slug
- `apps/web/src/app/api/escolas/[id]/nome/route.ts`
  - Resolução compatível com slug
- `apps/web/src/app/escola/[id]/admin/configuracoes/*`
  - Links e requests usam slug quando disponível
- `apps/web/src/components/escola/settings/*`
  - SettingsHub + marketplace + currículo agora usam slug em links
- `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`
  - APIs `escola` usam slug; `escolas` mantém UUID
- `apps/web/src/components/secretaria/*`
  - Fluxos de documentos/pagamentos/turma usam slug em navegação
- `apps/web/src/components/layout/escola-admin/*`
  - Dashboard usa slug nos links de avisos/eventos/KPIs/ações
- `apps/web/src/app/escola/[id]/admin/relatorios/page.tsx`
  - Base path passa a usar slug
- `apps/web/src/app/escola/[id]/horarios/*`
  - Navegação interna usa slug
- `apps/web/src/components/layout/escola-admin/*`
  - Dashboard usa slug nos links de avisos/eventos/KPIs/ações
- `apps/web/src/app/api/escola/[id]/billing/stripe-portal/route.ts`
  - `return_url` com slug
- `apps/web/src/app/api/super-admin/escolas/[id]/billing-email/route.ts`
  - Links de cobrança com slug
- `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`
  - `nextPath` com slug e queries usando `escolaId` resolvido

## Rotas cobertas
- `/escola/{slug}/**` (rewrite interno para UUID)
- `/escola/{uuid}/**` (redirect 302 para slug)
- `/api/escola/{slug}/**` (rewrite interno para UUID)

## Pendências / próximos passos
1) Atualizar links internos restantes para usar slug (reduz redirects). ✅
2) Expor `slug` em views/consultas administrativas quando necessário.
3) Após estabilização, trocar redirect 302 → 301. ✅
4) Auditoria final em rotas externas (emails, notificações, boletos, relatórios).

## Diff resumido
- `supabase/migrations/20260328000000_escolas_slug.sql`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/tenant/resolveEscolaIdForUser.ts`
- `apps/web/src/lib/tenant/resolveEscolaParam.ts`
- `apps/web/src/lib/tenant/escolaSlug.ts`
- `apps/web/src/hooks/useEscolaId.ts`
- `apps/web/src/components/layout/klasse/AppShell.tsx`
- `apps/web/src/app/secretaria/client-layout.tsx`
- `apps/web/src/app/escola/[id]/page.tsx`
- `apps/web/src/app/escola/[id]/onboarding/page.tsx`
- `apps/web/src/app/api/escolas/[id]/nome/route.ts`
- `types/supabase.ts`
