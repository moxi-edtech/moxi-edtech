# REPORT_SCAN.md — KLASSE PERFORMANCE AUDIT

## 1. SUMÁRIO EXECUTIVO

- Findings CRÍTICOS: **1**
- Findings ALTO: **0**
- Findings MÉDIO: **0**
- Findings BAIXO: **0**
- Status final: **FAIL**

## 2. ACHADOS (ordenado por severidade)

### FIN-001 — `vw_financeiro_dashboard` não encapsula `mv_*`
- Severidade: **CRITICAL**
- Evidências:
  - `supabase/migrations/20260127020400_klasse_p0_aggregates_outbox_worker.sql` — `vw_financeiro_dashboard` lê `aggregates_financeiro`
  - DB remoto: `public.vw_financeiro_dashboard` aponta para `public.aggregates_financeiro`
- Recomendação: Criar `mv_financeiro_dashboard` + `UNIQUE INDEX` + `refresh_mv_financeiro_dashboard` + `cron.schedule`, e atualizar a view `vw_financeiro_dashboard` para consumir a MV.

## 3. VALIDAÇÕES EXECUTADAS

- Admin/Super-admin: KPIs em `vw_admin_dashboard_counts` + `pagamentos_status`
- Financeiro: KPIs em `vw_financeiro_dashboard`
- Secretaria: rematrícula usa `vw_secretaria_matriculas_turma_status`
- Cache: removido `force-cache` em financeiro/relatórios e `s-maxage` em dashboard insights
