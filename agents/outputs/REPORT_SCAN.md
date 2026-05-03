# REPORT_SCAN.md — KLASSE FOUNDATION AUDIT

- Verificado em: `2026-05-03T15:55:29.044Z`

## 1. SUMÁRIO EXECUTIVO

- Findings CRÍTICOS: **0**
- Findings ALTO: **5**
- Total findings: **7**

## 2. ACHADOS (ordenado por severidade)

### NO_STORE — Anti-pattern — uso de cache: 'no-store' em páginas/relatórios
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `docs/big-tech-performance.md` — match: /cache:\s*['\"]no-store['\"]/i
  - `tools/fiscal/build-agt-evidence.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `tools/validator/fluency-validator-monorepo.js` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/auth/lib/rateLimit.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/lib/auth-admin-job.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/lib/funnel-client.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `docs/fiscal/ui/fiscal-ui-ux-fase5.md` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/auth/app/login/actions.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/components/aluno/CarreiraHubClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/components/aluno/TalentOptInPrompt.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/components/cohorts/AdminCohortsPageClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/components/mentorias/MentoriasPageClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/lib/integrations/fiscal.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/lib/integrations/payment.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/hooks/useMatriculaLogic.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/auth-admin-job.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/escolaInfoClient.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/financeiroTabelasClient.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/periodosLetivosClient.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/schoolSessionsClient.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/web/src/lib/setupStateClient.ts` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/app/(portal)/agenda/AgendaClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/app/(portal)/honorarios/HonorariosClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/app/(portal)/pagamentos/PagamentosClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
  - `apps/formacao/app/(portal)/meus-cursos/MeusCursosClient.tsx` — match: /cache:\s*['\"]no-store['\"]/i
- Recomendação: Remover no-store onde houver MV/camadas cacheáveis; manter só em rotas realmente sensíveis.

### F09_MV — F09 — Radar de Inadimplência com MATERIALIZED VIEW
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_radar_inadimplencia/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations/20261127000002_fix_refresh_mv_radar_inadimplencia.sql` — match: /refresh_mv_radar_inadimplencia\s*\(/i
  - `supabase/migrations_archive/migrations/20251120100000_create_financial_module.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
  - `supabase/migrations_archive/migrations/20251123230000_replace_vw_radar_inadimplencia.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
  - `supabase/migrations_archive/migrations/20251124133000_align_financeiro_schema.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.vw_radar_inadimplencia/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### F18_MV — F18 — Caixa/Propinas com MATERIALIZED VIEW
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /CREATE\s+UNIQUE\s+INDEX\s+.*ux_mv_pagamentos_status/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations/20260202010300_fix_pagamentos_status_refresh.sql` — match: /refresh_mv_pagamentos_status\s*\(/i
  - `supabase/migrations_archive/migrations_backup/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
  - `supabase/migrations_archive/migrations/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
  - `supabase/migrations_archive/migrations_backup/migrations/20250916000100_create_views.sql` — match: /CREATE\s+OR\s+REPLACE\s+VIEW\s+public\.pagamentos_status/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper.

### P0_3_MV_DASHBOARDS — P0.3 — Dashboards Secretaria/Admin em MATERIALIZED VIEW
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261127000004_fix_refresh_mv_secretaria_dashboard_counts.sql` — match: /mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /ux_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20261127000004_fix_refresh_mv_secretaria_dashboard_counts.sql` — match: /refresh_mv_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /vw_secretaria_dashboard_counts/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /mv_secretaria_matriculas_status/i
  - `supabase/migrations/20261201210000_update_financeiro_kpis_realistic.sql` — match: /mv_secretaria_matriculas_status/i
  - `supabase/migrations/20261212000002_fix_secretaria_import_pendencias.sql` — match: /mv_secretaria_matriculas_status/i
  - `supabase/migrations/20260127020139_remote_schema.sql` — match: /ux_mv_secretaria_matriculas_status/i
- Recomendação: Garantir MV + UNIQUE INDEX + refresh function + cron job + view wrapper para secretária e admin (sem cálculo ao vivo).

### PLAN_GUARD — P0.3 — Controle de planos (backend + UI)
- Severidade: **HIGH**
- Status: **PARTIAL**
- Evidências:
  - `apps/web/src/app/api/financeiro/recibos/emitir/route.ts` — backend guard (fin_recibo_pdf): sim
  - `apps/web/src/app/api/financeiro/extrato/aluno/[alunoId]/pdf/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/app/api/secretaria/turmas/[id]/alunos/pdf/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/app/api/secretaria/turmas/[id]/alunos/lista/route.ts` — backend guard (doc_qr_code): sim
  - `apps/web/src/components/financeiro/ReciboImprimivel.tsx` — ui guard (fin_recibo_pdf): não
  - `apps/web/src/components/financeiro/ExtratoActions.tsx` — ui guard (doc_qr_code): sim
  - `apps/web/src/components/secretaria/TurmaDetailClient.tsx` — ui guard (doc_qr_code): sim
- Recomendação: Garantir requireFeature em rotas premium e usePlanFeature em entrypoints UI.

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
  - `temp_supabase_output.ts` — match: /audit_logs|auditLog|create_audit/i
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
  - `supabase/migrations/20260203000004_rpc_gerar_turmas_from_curriculo.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000005_rpc_onboard_academic_structure.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000006_refactor_frequencia_ssot.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000007_rpc_lancar_notas_batch.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000009_rpc_fechar_periodo_unificado.sql` — match: /audit_logs|auditLog|create_audit/i
  - `supabase/migrations/20260203000010_rpc_transferir_matricula.sql` — match: /audit_logs|auditLog|create_audit/i
- Recomendação: Padronizar schema: actor, action, entity, before, after, ip, created_at; garantir coverage financeiro/matrícula.
