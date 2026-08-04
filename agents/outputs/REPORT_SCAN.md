# REPORT_SCAN.md — KLASSE FOUNDATION AUDIT

- Verificado em: `2026-08-04T22:22:09.820Z`

## 1. SUMÁRIO EXECUTIVO

- Findings CRÍTICOS: **0**
- Findings ALTO: **0**
- Total findings: **6**

## 2. ACHADOS (ordenado por severidade)

### KF2 — KF2 — Pesquisa Global (Command Palette) invariants
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `apps/web/src/components/GlobalSearch.tsx` — debounce detectado (hook/client): sim
  - `apps/web/src/hooks/useGlobalSearch.ts` — rpc min: sim
  - `apps/web/src/hooks/useGlobalSearch.ts` — limit clamp <= 50: sim
  - `supabase/migrations` — ORDER BY id DESC: sim
  - `apps/web/src/hooks/useGlobalSearch.ts` — useGlobalSearch encontrado
- Recomendação: KF2 deve ter debounce 250–400ms, limit<=50, orderBy estável e payload mínimo.

### GF4 — GF4 — Audit Trail (parcial/validar cobertura before/after)
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `AGENTS.md` — match: /audit_logs|auditLog|create_audit/i
  - `CHANGELOG.md` — match: /audit_logs|auditLog|create_audit/i
  - `DOUBLE_CHECK_REPORT_ADMISSAO_P0_V2.md` — match: /audit_logs|auditLog|create_audit/i
  - `README.md` — match: /audit_logs|auditLog|create_audit/i
  - `REPORT_ADMISSAO_P0.md` — match: /audit_logs|auditLog|create_audit/i
  - `plan_crm_execution_backlog.md` — match: /audit_logs|auditLog|create_audit/i
  - `plan_crm_execution_status.md` — match: /audit_logs|auditLog|create_audit/i
  - `temp_supabase_output.ts` — match: /audit_logs|auditLog|create_audit/i
  - `docs/PLANO_EXECUCAO_UX_FINANCEIRO_SECRETARIA.md` — match: /audit_logs|auditLog|create_audit/i
  - `docs/inventario-portal-admin-escola-2026-04-03.md` — match: /audit_logs|auditLog|create_audit/i
  - `scripts/README.md` — match: /audit_logs|auditLog|create_audit/i
  - `types/database.ts` — match: /audit_logs|auditLog|create_audit/i
  - `types/supabase.ts` — match: /audit_logs|auditLog|create_audit/i
  - `docs/academico/historico-imutavel.md` — match: /audit_logs|auditLog|create_audit/i
  - `docs/academico/runbook-fechamento-academico.md` — match: /audit_logs|auditLog|create_audit/i
  - `tools/validator/fluency-validator-monorepo.js` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260127020700_admin_get_escola_health_metrics_rpc.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260127140000_create_confirmar_conciliacao_transacao_rpc.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260202000000_klasse_p0_compliance_fixes.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260202002000_sync_lancamentos_registrar_pagamento.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260202003000_set_created_by_on_paid_lancamentos.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000000_rpc_setup_active_ano_letivo.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000002_rpc_upsert_bulk_periodos_letivos.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000003_add_audit_to_curriculo_publish.sql` — match: /audit_logs|auditLog|create_audit/i
- Recomendação: Padronizar schema: actor, action, entity, before, after, ip, created_at; garantir coverage financeiro/matrícula.

### F09_MV — F09 — Radar de Inadimplência com MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+MATERIALIZED\s+VIEW\s+\"?internal\"?\.\"?mv_radar_inadimplencia\"?/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_radar_inadimplencia/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20261127000002_fix_refresh_mv_radar_inadimplencia.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20270714112000_harden_radar_inadimplencia_grants.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20270718132000_harden_internal_mv_refresh_grants.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20270726110500_fix_radar_inadimplencia_authenticated_access.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### F18_MV — F18 — Caixa/Propinas com MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+MATERIALIZED\s+VIEW\s+\"?internal\"?\.\"?mv_pagamentos_status\"?/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_pagamentos_status/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20260202010300_fix_pagamentos_status_refresh.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20270718120000_restore_required_mv_cron_jobs.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20270718132000_harden_internal_mv_refresh_grants.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20260202000000_klasse_p0_compliance_fixes.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.(?:vw_)?pagamentos_status/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### P0_3_MV_DASHBOARDS — P0.3 — Dashboards Secretaria/Admin em MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261127000004_fix_refresh_mv_secretaria_dashboard_counts.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20270718132000_harden_internal_mv_refresh_grants.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /ux_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261127000004_fix_refresh_mv_secretaria_dashboard_counts.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20270718132000_harden_internal_mv_refresh_grants.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /vw_secretaria_dashboard_counts/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper para secretária e admin (sem cálculo ao vivo).

### PLAN_GUARD — P0.3 — Controle de planos (backend + UI)
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `apps/web/src/app/api/financeiro/recibos/emitir/route.ts` — backend guard (fin_recibo_pdf): sim
  - `apps/web/src/app/api/financeiro/extrato/aluno/[alunoId]/pdf/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/app/api/secretaria/turmas/[id]/alunos/pdf/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/app/api/secretaria/turmas/[id]/alunos/lista/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/components/financeiro/ReciboImprimivel.tsx` — ui guard (fin_recibo_pdf): sim
  - `apps/web/src/components/financeiro/ExtratoActions.tsx` — ui guard (doc_qr_code): sim
  - `apps/web/src/components/secretaria/TurmaDetailClient.tsx` — ui guard (doc_qr_code): sim
- Recomendação: Garantir requireFeature em rotas premium e usePlanFeature em entrypoints UI.
