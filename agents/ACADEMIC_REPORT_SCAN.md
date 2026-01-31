# ACADEMIC_REPORT_SCAN.md — Big Tech Performance & Compliance

Severidade: **CRITICAL**

## Escopo
Auditoria de DB (migrations aplicadas via `supabase db push`), APIs, libs e componentes conforme `docs/big-tech-performance.md`.

## Relação com o padrão Big Tech
- Pilar A (Reads pré-calculados): migrations `20260201000000_p0_performance_compliance.sql` + `20260201001000_mv_financeiro_missing_pricing.sql` criam `mv_*`, `vw_*`, `refresh_mv_*` e cron.
- Pilar B (Writes instantâneos): `20260127020400_klasse_p0_aggregates_outbox_worker.sql` e `20260127020500_fix_p0_issues.sql` implementam outbox + worker + idempotência.
- Pilar C (Cache correto): várias rotas já usam `dynamic = 'force-dynamic'` e `revalidate = 0`, porém fetches críticos em componentes não definem `cache: 'no-store'`.

## Inventário de MVs (migrations atuais)
- `internal.mv_admin_dashboard_counts`
- `internal.mv_admin_pending_turmas_count`
- `internal.mv_admissoes_counts_por_status`
- `internal.mv_escola_cursos_stats`
- `internal.mv_escola_info`
- `internal.mv_escola_setup_status`
- `internal.mv_financeiro_cobrancas_diario`
- `internal.mv_financeiro_dashboard`
- `internal.mv_financeiro_propinas_mensal_escola`
- `internal.mv_financeiro_propinas_por_turma`
- `internal.mv_financeiro_sidebar_badges`
- `internal.mv_financeiro_missing_pricing_count`
- `internal.mv_ocupacao_turmas`
- `internal.mv_radar_inadimplencia`
- `internal.mv_secretaria_dashboard_counts`
- `internal.mv_secretaria_dashboard_kpis`
- `internal.mv_top_cursos_media`
- `internal.mv_top_turmas_hoje`
- `internal.mv_total_em_aberto_por_mes`
- `public.mv_financeiro_escola_dia`
- `public.mv_freq_por_turma_dia`

## Cobertura P0.3 — Rotas obrigatórias
- `/financeiro/radar` → `vw_radar_inadimplencia` → `internal.mv_radar_inadimplencia` (OK)
- `/financeiro/sidebar-badges` → `vw_financeiro_sidebar_badges` → `internal.mv_financeiro_sidebar_badges` (OK)
- `/financeiro/aberto-por-mes` → `vw_total_em_aberto_por_mes` → `internal.mv_total_em_aberto_por_mes` (OK)
- `/financeiro/cobrancas/resumo` → `vw_financeiro_cobrancas_diario` → `internal.mv_financeiro_cobrancas_diario` (OK)
- `/financeiro/graficos/mensal` → `vw_total_em_aberto_por_mes` → `internal.mv_total_em_aberto_por_mes` (OK)
- `/financeiro/relatorios/propinas` → `vw_financeiro_propinas_mensal_escola` + `vw_financeiro_propinas_por_turma` (OK)
- `/secretaria/dashboard/*` → `vw_secretaria_dashboard_counts` + `vw_secretaria_dashboard_kpis` (OK)
- `/secretaria/turmas/ocupacao` → `vw_ocupacao_turmas` → `internal.mv_ocupacao_turmas` (OK)
- `/secretaria/matriculas/preview-numero` → 501 (PENDING)
- `/admin/dashboard/pending-turmas-count` → `vw_admin_pending_turmas_count` (OK)
- `/escolas/[id]/insights/quick` → `vw_top_turmas_hoje` + `vw_top_cursos_media` (OK)
- `/escolas/[id]/cursos/stats` → `vw_escola_cursos_stats` (OK)
- `/escolas/[id]/plano` → `vw_escola_info` (OK)
- `/escolas/[id]/nome` → `vw_escola_info` (OK)

## Achados críticos
- Rotas sem `resolveEscolaIdForUser` em áreas financeiras: `apps/web/src/app/api/financeiro/aberto-por-mes/route.ts`, `apps/web/src/app/api/financeiro/cobrancas/resumo/route.ts`, `apps/web/src/app/api/financeiro/graficos/mensal/route.ts`, `apps/web/src/app/api/financeiro/relatorios/propinas/route.ts`, `apps/web/src/app/api/financeiro/radar/route.ts`, `apps/web/src/app/api/financeiro/missing-pricing/route.ts`.
- Uso de `profiles` sem `.eq('user_id', user.id)` em APIs: `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts`, `apps/web/src/app/api/escolas/[id]/usuarios/toggle/route.ts`, `apps/web/src/app/api/escolas/[id]/usuarios/update/route.ts`.

## Validação DB sugerida (rodar localmente)
- Conectar e checar MVs + índices:
  - `\d+ internal.mv_financeiro_dashboard`
  - `\d+ internal.mv_financeiro_propinas_mensal_escola`
  - `\d+ internal.mv_financeiro_missing_pricing_count`
  - `\d+ internal.mv_secretaria_dashboard_counts`
  - `\d+ internal.mv_ocupacao_turmas`
- Verificar cron jobs:
  - `SELECT * FROM cron.job WHERE command ILIKE '%REFRESH MATERIALIZED VIEW%';`

## Status final
- **FAIL** — bloqueio por violações críticas de multi-tenant e política de acesso a `profiles`.

## Execução de migrations (remoto)
- `supabase db push` aplicado com sucesso em 2026-02-03.
- Ajustes aplicados nas migrations:
  - `20260203000001_refactor_import_alunos_rpc.sql`: `DROP FUNCTION IF EXISTS` antes de recriar.
  - `20260203000004_rpc_gerar_turmas_from_curriculo.sql`: loops JSON corrigidos e `v_turno` declarado.
  - `20260203000006_refactor_frequencia_ssot.sql`: view `presencas` corrigida e lógica de upsert ajustada.
