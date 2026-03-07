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

## Rotas cobertas
- `/escola/{slug}/**` (rewrite interno para UUID)
- `/escola/{uuid}/**` (redirect 302 para slug)
- `/api/escola/{slug}/**` (rewrite interno para UUID)

## Pendências / próximos passos
1) Atualizar links internos para usar slug (reduz redirects).
2) Expor `slug` em views/consultas administrativas quando necessário.
3) Após estabilização, trocar redirect 302 → 301.
4) Auditoria final em rotas externas (emails, notificações, boletos, relatórios).

## Diff resumido
- `supabase/migrations/20260328000000_escolas_slug.sql`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/tenant/resolveEscolaIdForUser.ts`
- `apps/web/src/lib/tenant/resolveEscolaParam.ts`
- `apps/web/src/lib/tenant/escolaSlug.ts`
- `types/supabase.ts`
