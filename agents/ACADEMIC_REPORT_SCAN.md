# REPORT_SCAN — P0.4 Service Role + Pedagógico

Severidade: CRITICAL

## Escopo
Verificação P0.4 (service role fora de jobs/workers/provisioning/cron) + contexto pedagógico existente.

## Evidências (paths)
Service role em endpoints humanos ainda presentes (BLOCKER):
- `apps/web/src/app/api/super-admin/users/reset-password/route.ts`
- `apps/web/src/app/api/super-admin/users/generate-login-number/route.ts`
- `apps/web/src/app/api/super-admin/users/delete/route.ts`
- `apps/web/src/app/api/super-admin/users/update/route.ts`
- `apps/web/src/app/api/super-admin/users/list/route.ts`
- `apps/web/src/app/api/super-admin/escolas/list/route.ts`
- `apps/web/src/app/api/super-admin/escolas/onboarding/progress/route.ts`
- `apps/web/src/app/api/super-admin/escolas/[id]/resend-invite/route.ts`
- `apps/web/src/app/api/super-admin/escolas/[id]/delete/route.ts`
- `apps/web/src/app/api/super-admin/escolas/[id]/billing-email/route.ts`
- `apps/web/src/app/api/escolas/[id]/alunos/invite/route.ts`
- `apps/web/src/app/api/escolas/[id]/alunos/novo/route.ts`
- `apps/web/src/app/api/alunos/ativar-acesso/route.ts`
- `apps/web/src/app/api/escolas/[id]/financeiro/pagamentos/novo/route.ts`
- `apps/web/src/app/api/escolas/[id]/financeiro/vendas/avulsa/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/preferences/route.ts`
- `apps/web/src/app/api/escolas/[id]/semestres/[semestreId]/route.ts`
- `apps/web/src/app/api/escolas/[id]/semestres/reset/route.ts`
- `apps/web/src/app/api/escolas/[id]/secoes/[secaoId]/delete/route.ts`
- `apps/web/src/app/api/escolas/[id]/seed/academico/route.ts`
- `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts`

Service role permitido (jobs/debug):
- `apps/web/src/app/api/jobs/auth-admin/route.ts`
- `apps/web/src/app/api/jobs/outbox/route.ts`
- `apps/web/src/app/api/debug/email/route.ts`

Atualizações recentes:
- Rotas `escolas/[id]/cursos/*` e `escolas/[id]/school-sessions` já sem service role.
- Policies RLS aplicadas para leitura: `anos_letivos`, `periodos_letivos`.
- Policies RLS aplicadas para write: `curso_matriz`, `turma_disciplinas`.
- Índices UNIQUE adicionados em `curso_matriz` para suportar upserts.
- Dashboard financeiro atualizado com KPIs operacionais (previsto/realizado/inadimplência) e radar top 5.
- MVs financeiras criadas: `mv_financeiro_kpis_mes` + `mv_financeiro_radar_resumo` (views `vw_*`, refresh + cron).
- Marketplace alinhado ao install-preset com validação de setup e payload completo.
- Onboarding Step 3 migrou para `install-preset` com `autoPublish`.
- Fix de hooks no `TurmaDetailClient` (ordem consistente) e cache `no-store` em turmas admin.
- Alinhada a listagem de turmas Admin/Secretaria com `adminMode` e aprovação de pendentes.
- RLS corrigido para `curso_matriz`, `turma_disciplinas`, `anos_letivos`, `periodos_letivos`.
- Índices UNIQUE full em `curso_matriz` para `upsert` (sem partial where).

Contexto pedagógico (mapa existente):
- `apps/web/src/components/escola/settings/CurriculumBuilder.tsx`
- `apps/web/src/app/api/professor/notas/route.ts`
- `apps/web/src/app/api/professor/presencas/route.ts`
- `supabase/migrations/20261019227000_notas_boletim_views.sql`
- `supabase/migrations/20261019228000_avaliacoes_trimestres.sql`

## Recomendação
Migrar rotas humanas restantes para client SSR + RLS e usar o job `/api/jobs/auth-admin` para operações `auth.admin`.
