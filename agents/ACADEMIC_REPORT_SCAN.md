# ACADEMIC_REPORT_SCAN.md — Performance & Dashboards

Severidade: **CRITICAL**

## Escopo
Auditoria de performance em dashboards/relatórios/portais (Admin, Financeiro, Secretaria) e validação de MV/VW no banco remoto.

## Achado Crítico
**FIN-001 — `vw_financeiro_dashboard` não encapsula `mv_*`.**
- Evidências:
  - `supabase/migrations/20260127020400_klasse_p0_aggregates_outbox_worker.sql` — `vw_financeiro_dashboard` lê `aggregates_financeiro`.
  - Banco remoto: `public.vw_financeiro_dashboard` aponta para `public.aggregates_financeiro`.
- Impacto: viola regra “vw_* encapsula mv_*” em dashboard financeiro.
- Recomendação: criar `mv_financeiro_dashboard` (com `UNIQUE INDEX`, `refresh_mv_*`, `cron.schedule`) e ajustar a view `vw_financeiro_dashboard`.

## Validações positivas
- Admin: `vw_admin_dashboard_counts` + `pagamentos_status`.
- Financeiro: leitura em `vw_financeiro_dashboard`.
- Secretaria: rematrícula usa `vw_secretaria_matriculas_turma_status`.
- Cache indevido removido em `financeiro/*` e `/api/escolas/[id]/insights/quick`.
