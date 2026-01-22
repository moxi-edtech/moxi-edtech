# REPORT_SCAN — Pedagógico (Monorepo)

Severidade: LOW

## Escopo
Mapeamento de rotas, componentes e objetos de banco relacionados a Pedagógico (disciplinas, notas, avaliações, presenças, turmas).

## Evidências (paths)
- `apps/web/src/components/secretaria/TurmaDetailClient.tsx` — aba Pedagógico na turma.
- `apps/web/src/components/escola/settings/StructureMarketplace.tsx` — visão de currículo/disciplinas por curso.
- `apps/web/src/components/escola/settings/CurriculumBuilder.tsx` — editor de currículo.
- `apps/web/src/app/escola/[id]/avaliacoes/page.tsx` — avaliações.
- `apps/web/src/app/escola/[id]/admin/notas/page.tsx` — notas admin.
- `apps/web/src/app/professor/notas/page.tsx` — notas professor.
- `apps/web/src/app/professor/frequencias/page.tsx` — presenças professor.
- `apps/web/src/app/(portal-aluno)/aluno/disciplinas/page.tsx` — disciplinas aluno.
- `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts` — detalhes da turma (disciplinas).
- `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts` — disciplinas da turma.
- `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts` — vínculo professor.
- `apps/web/src/app/api/secretaria/turmas/[id]/pauta/route.ts` — pauta da turma.
- `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts` — catálogo/matriz.
- `apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply/route.ts` — aplicação de currículo.
- `apps/web/src/app/api/professor/notas/route.ts` — notas.
- `apps/web/src/app/api/professor/presencas/route.ts` — presenças.
- `apps/web/src/app/api/aluno/disciplinas/route.ts` — disciplinas aluno.
- `supabase/migrations/20260107200000_ssot_and_auto_turma_disciplinas.sql` — autofill turma_disciplinas.
- `supabase/migrations/20260307090000_fix_sync_disciplinas_trigger.sql` — trigger de sync.
- `supabase/migrations/20261019226000_presencas_views.sql` — views presenças.
- `supabase/migrations/20261019228000_avaliacoes_trimestres.sql` — avaliações.
- `supabase/migrations/20261019227000_notas_boletim_views.sql` — notas/boletim.

## Objetos de banco envolvidos
- `turma_disciplinas_professores`
- `turma_disciplinas`
- `curso_matriz`
- `disciplinas_catalogo`
- `syllabi`
- `avaliacoes`, `notas`, `presencas` (e legados quando aplicável)

## Observações
- `turma_disciplinas` não possui relação direta com `professores` no PostgREST.
- `curso_matriz` e `turma_disciplinas` dependem de RLS/permissions (service role em alguns fluxos).

## Recomendações
- Criar um doc único de Pedagógico com fluxos, owners e SLAs de performance por tela.
- Padronizar origem de disciplinas: `turma_disciplinas_professores` → fallback `turma_disciplinas` → fallback `curso_matriz`.
- Formalizar políticas RLS para `curso_matriz`/`turma_disciplinas` ou declarar uso de service role em endpoints críticos.
- Criar view derivada para indicadores pedagógicos (evitar cálculo ao vivo em tela).
- Definir checklist de consistência: turma sem disciplinas, disciplina sem professor, syllabus ausente.

## Referências
- `docs/pedagogico-map.md`
