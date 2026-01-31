# REPORT_SCAN.md — KLASSE Compliance Audit

## 1. SUMÁRIO EXECUTIVO

- Findings CRÍTICOS: **2**
- Findings HIGH: **0**
- Findings MEDIUM: **2**
- Findings LOW: **1**
- Status final: **FAIL**

## 2. RELAÇÃO COM `docs/big-tech-performance.md`

- `supabase/migrations/20260127020400_klasse_p0_aggregates_outbox_worker.sql`: implementa Pilar A (aggregates físicos) e Pilar B (outbox + worker).
- `supabase/migrations/20260127020500_fix_p0_issues.sql`: corrige worker/outbox e adiciona view para consumo rápido.
- `supabase/migrations/20260201000000_p0_performance_compliance.sql`: cria `mv_*` + `vw_*` + `refresh_mv_*` + cron, alinhando ao Pilar A.
- `supabase/migrations/20260201001000_mv_financeiro_missing_pricing.sql`: MV + wrapper + cron para KPI financeiro.
- `supabase/migrations/20260127020200_klasse_p0b_rls_cleanup.sql`: endurece RLS e índices, reduzindo custo de leitura multi-tenant.

## 3. ACHADOS (ordenado por severidade)

### CRITICAL — Rotas sem `resolveEscolaIdForUser`
- Evidências:
  - `apps/web/src/app/api/financeiro/aberto-por-mes/route.ts`
  - `apps/web/src/app/api/financeiro/cobrancas/resumo/route.ts`
  - `apps/web/src/app/api/financeiro/graficos/mensal/route.ts`
  - `apps/web/src/app/api/financeiro/relatorios/propinas/route.ts`
  - `apps/web/src/app/api/financeiro/radar/route.ts`
  - `apps/web/src/app/api/financeiro/missing-pricing/route.ts` (resolver próprio, sem `resolveEscolaIdForUser`)
- Recomendação: padronizar resolução de escola via `resolveEscolaIdForUser` em todas as rotas públicas.

### CRITICAL — Uso de `profiles` sem `.eq('user_id', user.id)`
- Evidências:
  - `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts` (lookup de diretor por `user_id` externo)
  - `apps/web/src/app/api/escolas/[id]/usuarios/toggle/route.ts` (lookup por `email`)
  - `apps/web/src/app/api/escolas/[id]/usuarios/update/route.ts` (lookup por `email`)
- Recomendação: centralizar acesso a perfis por RPC segura ou garantir `.eq('user_id', user.id)` para o usuário autenticado.

### MEDIUM — `limit > 50`
- Evidências:
  - `apps/web/src/app/api/escolas/[id]/cursos/stats/route.ts` (`defaultLimit: 500`)
  - `apps/web/src/app/api/super-admin/escolas/list/route.ts` (`defaultLimit: 1000`)
- Recomendação: paginar e manter `limit <= 50` nas rotas públicas.

### MEDIUM — Cache explícito ausente em fetch crítico
- Evidências:
  - `apps/web/src/components/secretaria/OcupacaoClient.tsx` (fetch sem `cache: 'no-store'`)
  - `apps/web/src/app/financeiro/_components/RadarInadimplenciaActive.tsx` (fetch sem `cache: 'no-store'`)
- Recomendação: aplicar `cache: 'no-store'` para dados críticos de secretaria/financeiro no cliente.

### LOW — Uso de `count: 'exact'`
- Evidências:
  - `apps/web/src/app/api/escolas/[id]/onboarding/session/[sessionId]/route.ts`
  - `apps/web/src/app/api/escolas/[id]/onboarding/session/[sessionId]/reassign/route.ts`
- Recomendação: substituir por MV de contagem quando virar KPI/uso recorrente.

## 4. MIGRATIONS APLICADAS (REMOTO)
- `supabase db push` aplicado com sucesso.
- Migrations pendentes aplicadas: `20260203000006_refactor_frequencia_ssot.sql`, `20260203000007_rpc_lancar_notas_batch.sql`, `20260203000008_materialize_vw_boletim.sql`.
- Correções locais feitas para destravar o push:
  - `20260203000001_refactor_import_alunos_rpc.sql` (drop function antes de recriar).
  - `20260203000004_rpc_gerar_turmas_from_curriculo.sql` (loops JSON).
  - `20260203000006_refactor_frequencia_ssot.sql` (view `presencas` e upsert).
