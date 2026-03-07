# Relatório — URLs de Escola (UUID vs Slug/Subdomínio)

Data: 2026-03-06

## Situação actual
- Iniciada migração para slug no path.
- URL pública aceita slug, mantendo compatibilidade com UUID:
  - Exemplo (slug): `https://klasse.ao/escola/{slug}/admin/dashboard`
  - Exemplo (legado): `https://klasse.ao/escola/<uuid>/admin/dashboard`

## Riscos / impactos
- UX fraca (URL longa e pouco memorizável).
- Exposição de identificadores internos (UUIDs).
- Facilita tentativa de enumeração/força bruta em rotas públicas.
- Reduz qualidade de SEO (quando aplicável).

## Alternativas recomendadas
1) **Subdomínio por escola**
   - `https://{slug}.klasse.ao/admin/dashboard`
   - Melhor isolamento por portal e mais profissional.

2) **Slug em path**
   - `https://klasse.ao/escola/{slug}/admin/dashboard`
   - Menos mudança infra, ainda evita UUID exposto.

## Recomendação actual
- **Slug em path** (decisão fechada para esta fase).

## Plano de migração (estado)
1) Criar coluna `slug` em `escolas` (único, normalizado, obrigatório). ✅
2) Backfill automático com deduplicação + trigger para novos registros. ✅
3) Resolver `{slug} → escola_id` no backend. ✅
4) Ajustar rotas para aceitar `{slug}` e redirecionar `{uuid}` antigo. ✅
5) Atualizar links internos e emails. ⏳ (parcial: AppShell + redirect secretaria)
6) Considerar subdomínio/wildcard em fase futura. ⏳

## Implementação (referências)
- Migration: `supabase/migrations/20260328000000_escolas_slug.sql`
- Middleware: `apps/web/src/middleware.ts`
- Helpers: `apps/web/src/lib/tenant/resolveEscolaParam.ts`, `apps/web/src/lib/tenant/escolaSlug.ts`
- Resolução unificada: `apps/web/src/lib/tenant/resolveEscolaIdForUser.ts`

## Notas
- Compatibilidade: manter redirect de UUID por 12 meses (302 inicialmente, depois 301).
- Expor UUID apenas em APIs privadas/authenticated quando necessário.
