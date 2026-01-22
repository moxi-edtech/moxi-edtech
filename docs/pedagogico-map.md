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
