# REPORT_SCAN.md — KLASSE FOUNDATION AUDIT

## 1. SUMÁRIO EXECUTIVO

- Findings CRÍTICOS: **0**
- Findings ALTO: **1**
- Total findings: **7**

## 2. ACHADOS (ordenado por severidade)

### NO_STORE — Anti-pattern — uso de cache: 'no-store' em páginas/relatórios
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `AGENTS.md` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/components/secretaria/AlunosListClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
- Recomendação: Remover no-store onde houver MV/camadas cacheáveis; manter só em rotas realmente sensíveis.

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
  - `types/database.ts` — match: /audit_logs|auditLog|create_audit/i
  - `types/supabase.ts` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20251231163837_baseline.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20251231200952_remote_schema.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20261017000000_create_hard_delete_curso_rpc.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20261019002000_audit_trail_hardening.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20261019008000_audit_schema_min.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20261019009500_audit_actor_role.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/.branches/remote/schema.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations_backup/20250917060400_audit_redaction.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations_backup/20250917060500_audit_triggers.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations_backup/20250917060600_audit_user_default.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations_backup/20250917060700_create_audit_logs.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations_backup/20251108141000_fix_rls_initplan_policies.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20250915000000_remote_schema.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20250917060400_audit_redaction.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20250917060500_audit_triggers.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20250917060600_audit_user_default.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20250917060700_create_audit_logs.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251108141000_fix_rls_initplan_policies.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251116195500_normalize_auth_uid_in_policies.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251116211500_fix_audit_trigger_columns.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251116212500_secretaria_audit_view.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251214120000_add_rls_policies.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations_archive/migrations/20251217232511_optimize_rls_policies_v2.sql` — match: /audit_logs|auditLog|create_audit/i
- Recomendação: Padronizar schema: actor, action, entity, before, after, ip, created_at; garantir coverage financeiro/matrícula.

### F09_MV — F09 — Radar de Inadimplência com MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+MATERIALIZED\s+VIEW\s+public\.mv_radar_inadimplencia/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_radar_inadimplencia/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
  - `supabase/migrations_archive/migrations/20251120100000_create_financial_module.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
  - `supabase/migrations_archive/migrations/20251123230000_replace_vw_radar_inadimplencia.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
  - `supabase/migrations_archive/migrations/20251124133000_align_financeiro_schema.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### F18_MV — F18 — Caixa/Propinas com MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+MATERIALIZED\s+VIEW\s+public\.mv_pagamentos_status/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_pagamentos_status/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20260109_000001_mv_financeiro_dashboards.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
  - `supabase/migrations_archive/migrations_backup/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
  - `supabase/migrations_archive/migrations/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
  - `supabase/migrations_archive/migrations_backup/migrations/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### P0_3_MV_DASHBOARDS — P0.3 — Dashboards Secretaria/Admin em MATERIALIZED VIEW
- Severidade: **LOW**
- Status: **VALIDATED**
- Evidências:
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /ux_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /vw_secretaria_dashboard_counts/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /cron\.schedule\(['"]refresh_mv_secretaria_dashboard_counts['"]/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /mv_secretaria_matriculas_status/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /ux_mv_secretaria_matriculas_status/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /refresh_mv_secretaria_matriculas_status/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /vw_secretaria_matriculas_status/i
  - `supabase/migrations/20261019003000_mv_admin_secretaria_dashboards.sql` — match: /cron\.schedule\(['"]refresh_mv_secretaria_matriculas_status['"]/i
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
