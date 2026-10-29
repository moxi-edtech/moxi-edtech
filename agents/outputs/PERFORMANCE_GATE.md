# KLASSE — Performance Gate
contrato_versao: 2.0.0
run_timestamp: 2026-10-29T11:23:49.674784+00:00
run_id: cd3c7ab6-d94f-4dc4-af69-b5c76cc0f235

## Status: FAIL
Gate global não concluído: scanner legado não cobre o contrato integral (APY-004). Build global completo com validação de tipos aprovado; APY-002 resolvido. Isto não é finding de falha de performance confirmado. Não emitir PASS com base num scan parcial.

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
Mudança limitada aos controles de pagamento/extrato e endpoints AppyPay do aluno/worker; nenhuma query de dashboard alterada nesta finalização. A cobertura global MV-001, MV-003 e CACHE-002 permanece sem certificação neste run. Rotas AppyPay novas têm force-dynamic, revalidate=0, force-no-store e cabeçalhos no-store; chamadas ao provedor também no-store.

## Alertas de cálculo ao vivo
Nenhum introduzido nas rotas AppyPay alteradas. Sem findings MV-001 fora do escopo por falta da evidência exigida.

## Veredito
can_merge: false

## Extensão portal aluno
29 testes aprovados; seis grupos SQL locais aprovados. Build completo com tipos e 182 páginas aprovado; lint zero erros/um aviso preexistente. Novos endpoints e transporte interno usam no-store/force-dynamic. Broker usa destino fixo, assinatura com expiração e escopo derivado da sessão. Não altera consultas de dashboard. SQL de serviços proposto, ainda não aplicado; ver APY-005. Autorização de produção recebida; sem liberação enquanto a proposta financeira e o gate contratual não estiverem resolvidos.

## Bloqueio de release após instalação SQL
O SQL de serviços foi aprovado/aplicado e APY-005 está resolvido. A inspeção global confirmou três violações CRITICAL preexistentes em REPORT_SCAN.md. Mesmo com build e testes AppyPay aprovados, o contrato exige FAIL/can_merge=false; nenhuma liberação ou exceção foi aplicada. A matriz MV integral ainda requer certificação.

## Reverificação de 2026-10-29 — hardening após release externo
Os três blockers de segurança confirmados foram corrigidos nesta branch e cobertos por teste HTTP. A auditoria global/MV integral continua pendente: status FAIL, can_merge: false. Não há exceção autorizada. A publicação externa de #285/#295 foi observada, não executada por este run; APPYPAY_ENABLED permanece false.
