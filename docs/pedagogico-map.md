# Pedagógico — Mapa de Fluxos

## Objetivo
Documentar o fluxo Pedagógico (UI → API → DB), com origem única de dados e contratos de performance.

## Fluxos principais

### Turma › Aba Pedagógico
- UI: `apps/web/src/components/secretaria/TurmaDetailClient.tsx`
- API: `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts`
- Origem de disciplinas:
  1) `turma_disciplinas_professores`
  2) `turma_disciplinas`
  3) `curso_matriz`

### Estrutura › Currículo/Disciplinas
- UI: `apps/web/src/components/escola/settings/StructureMarketplace.tsx`
- API: `apps/web/src/app/api/escolas/[id]/cursos/[cursoId]/details/route.ts`
- API: `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts`
- Origem: `curso_matriz` + `disciplinas_catalogo`

### Avaliações e Notas
- UI: `apps/web/src/app/escola/[id]/avaliacoes/page.tsx`
- UI: `apps/web/src/app/escola/[id]/admin/notas/page.tsx`
- API: `apps/web/src/app/api/professor/notas/route.ts`
- DB: `avaliacoes`, `notas`, views `vw_*` quando aplicável

### Presenças
- UI: `apps/web/src/app/professor/frequencias/page.tsx`
- API: `apps/web/src/app/api/professor/presencas/route.ts`
- DB: `presencas`, views `vw_*` quando aplicável

## Contratos de Performance (Roadmap)
- Listagens p95 ≤ 500 ms
- Ação financeira p95 ≤ 200 ms
- Dashboards via derivados/MVs
- Pauta/grade: primeira render p95 ≤ 300 ms (skeleton imediato)
- Mutations pedagógicas: feedback visual ≤ 50 ms

## Metas p95 por fluxo acadêmico
- Turma › Aba Pedagógico: p95 ≤ 500 ms (origem única, sem cache).
- Estrutura › Currículo/Disciplinas: p95 ≤ 500 ms (cursor + `limit <= 30`).
- Avaliações e Notas: p95 ≤ 500 ms (listar) e feedback ≤ 50 ms.
- Presenças: p95 ≤ 500 ms (listar) e feedback ≤ 50 ms.

## Riscos conhecidos
- `turma_disciplinas` e `curso_matriz` com RLS restrito (service role em alguns endpoints).
- `turma_disciplinas` não possui relacionamento exposto com `professores` no PostgREST.

## Checklist de consistência
- Turma sem disciplinas
- Disciplina sem professor
- Syllabus ausente

## Próximos passos
- Consolidar owners e SLAs por tela.
- Definir view derivada para indicadores pedagógicos.

## Sessão atual — evidências
- Paginação/cursor em listas de cursos/classes/disciplinas:
  - `apps/web/src/app/api/escolas/[id]/cursos/route.ts`
  - `apps/web/src/app/api/escolas/[id]/cursos/stats/route.ts`
  - `apps/web/src/app/api/escolas/[id]/classes/route.ts`
- Onboarding paginado (sem select tudo):
  - `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`
- Setup/estrutura via MV:
  - `supabase/migrations/20261101120000_mv_escola_setup_status.sql`
  - `supabase/migrations/20261101121000_mv_escola_estrutura_counts.sql`
  - `apps/web/src/app/api/escola/[id]/admin/setup/status/route.ts`
