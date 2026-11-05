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

## Revalidação de merge — 2026-11-05T15:08:08.306099+00:00

Commit de fonte: `73203326085a1728e51bb2a72f870d37ea7a07f4`. PR #322. `can_merge: false` mantém-se: REPORT_SCAN.json confirma SEC-001 e SEC-002 CRITICAL ainda presentes na main e nesta branch. SEC-003 da cópia de calendário foi corrigido. Não foi feita certificação global nova da matriz de MVs neste run e os testes dirigidos do Balcão não substituem essa certificação. Nenhuma regra de performance é marcada como FAIL sem a evidência obrigatória.

## Reavaliação após correção de SEC-001/SEC-002 — 2026-11-05T15:30:38.023844+00:00

As duas rotas de risco foram corrigidas na PR #322; cinco testes de contrato e 148 regressões académicas aprovados. O scanner genérico não certifica integralmente MV-001/MV-002/MV-003/CACHE-002 nem o replay remoto. **can_merge: false permanece** até haver evidência global e homologação autenticada exigidas pelo contrato.
