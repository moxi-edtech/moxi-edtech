# KLASSE — Performance Gate
contrato_versao: 2.0.0
run_timestamp: 2026-10-28T22:43:15.571266+00:00
run_id: a1338163-1df9-4a14-9f79-ff677e5f3e84

## Status: FAIL
Gate global não concluído: scanner legado não cobre o contrato integral e o build global está pendente; a nova tentativa de typecheck, após recuperar dependências, foi inconclusiva. Isto não é um finding de falha de performance confirmado. Não emitir PASS com base num scan parcial.

## MVs
| MV | INDEX | Refresh Fn | Cron | Wrapper | Status |
|---|---|---|---|---|---|
| mv_secretaria_dashboard_counts | ✅ | ✅ | ✅ | ✅ | PASS (existência) |
| mv_secretaria_matriculas_status | ✅ | ✅ | ✅ | ✅ | PASS (existência) |
| mv_radar_inadimplencia | ✅ | ✅ | ✅ | ✅ | PASS (existência) |
| mv_pagamentos_status | ✅ | ✅ | ✅ | ✅ | PASS (existência) |

Artefactos encontrados por nome exato; não equivale a replay de todas as migrations nem prova de uso por todas as rotas.

### mv_secretaria_dashboard_counts
- MV: supabase/migrations/20260127020139_remote_schema.sql
- INDEX: supabase/migrations/20260127020139_remote_schema.sql
- Refresh Fn: supabase/migrations/20260127020139_remote_schema.sql
- Cron: supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql
- Wrapper: supabase/migrations/20260127020139_remote_schema.sql

### mv_secretaria_matriculas_status
- MV: supabase/migrations/20260127020139_remote_schema.sql
- INDEX: supabase/migrations/20260127020139_remote_schema.sql
- Refresh Fn: supabase/migrations/20260127020139_remote_schema.sql
- Cron: supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql
- Wrapper: supabase/migrations/20260127020139_remote_schema.sql

### mv_radar_inadimplencia
- MV: supabase/migrations/20260127020139_remote_schema.sql
- INDEX: supabase/migrations/20260127020139_remote_schema.sql
- Refresh Fn: supabase/migrations/20260127020139_remote_schema.sql
- Cron: supabase/migrations/20260804220000_restore_required_mv_refresh_crons.sql
- Wrapper: supabase/migrations/20260127020139_remote_schema.sql

### mv_pagamentos_status
- MV: supabase/migrations/20260127020139_remote_schema.sql
- INDEX: supabase/migrations/20260127020139_remote_schema.sql
- Refresh Fn: supabase/migrations/20260127020139_remote_schema.sql
- Cron: supabase/migrations/20260202010300_fix_pagamentos_status_refresh.sql
- Wrapper: supabase/migrations/20260202000000_klasse_p0_compliance_fixes.sql

## Dashboards cobertos
Nenhuma mudança em dashboard nesta tarefa. A cobertura global MV-001, MV-003 e CACHE-002 permanece sem certificação neste run. Rotas AppyPay novas têm force-dynamic, revalidate=0, force-no-store e cabeçalhos no-store; chamadas ao provedor também no-store.

## Alertas de cálculo ao vivo
Nenhum introduzido nas rotas AppyPay alteradas. Sem findings MV-001 fora do escopo por falta da evidência exigida.

## Veredito
can_merge: false
