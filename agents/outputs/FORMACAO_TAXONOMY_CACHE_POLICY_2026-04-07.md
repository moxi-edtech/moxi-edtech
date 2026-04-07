# Formação — Taxonomia de Rotas, Cache e Observabilidade (Ticket 5)

timestamp: 2026-04-07T00:00:00Z

## 1) Rotas Formação classificadas

### Financeiro transacional (no-store obrigatório)
- `/api/formacao/financeiro/**`
- `/api/formacao/cobrancas/**`
- `/api/formacao/faturas/**`
- `/api/formacao/honorarios/**`
- `/api/financeiro/**`

### Operações secretaria com valor legal (no-store obrigatório)
- `/api/secretaria/documentos/**` (certificados, pautas oficiais, comprovativos)

## 2) Política de cache mandatória

Para rotas acima:
- API route deve definir `export const dynamic = 'force-dynamic'`
- Requests do frontend devem usar `cache: 'no-store'`
- Evitar `revalidate > 0` para payload financeiro, pagamentos, recibos, extratos.

## 3) MVs para dashboards de formação

## MVs criadas
- `internal.mv_formacao_cohorts_lotacao`
- `internal.mv_formacao_inadimplencia_resumo`
- `internal.mv_formacao_margem_por_edicao`

## Wrappers públicos
- `public.vw_formacao_cohorts_lotacao`
- `public.vw_formacao_inadimplencia_resumo`
- `public.vw_formacao_margem_por_edicao`

## Refresh
- `public.refresh_mv_formacao_cohorts_lotacao()` + cron a cada 5 minutos
- `public.refresh_mv_formacao_inadimplencia_resumo()` + cron a cada 2 minutos
- `public.refresh_mv_formacao_margem_por_edicao()` + cron a cada 10 minutos

Todos os refresh usam `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

## 4) Observabilidade recomendada

- Logar duração de endpoints de `/api/financeiro/**` e `/api/formacao/financeiro/**`
- Alertar quando refresh de MV exceder 30s
- Alertar quando percentual de erros 5xx em endpoints financeiros > 1% por 5 minutos
- Adicionar tracing por `escola_id` para auditoria de latência tenant a tenant

## 5) Checklist de hard rules para agentes

- [ ] Sem query direta pesada em dashboard se MV equivalente existir
- [ ] Sem `force-cache` em rotas financeiras
- [ ] Sem `revalidate > 0` em pagamentos/recibos
- [ ] Cada MV tem UNIQUE INDEX
- [ ] Cada MV tem refresh function + cron

## 6) Decisão de escalabilidade multi-tenant (recomendação)

- Estratégia preferida: **schema partilhado** com isolamento por `tenant_id` + `tenant_type`.
- `tenant_type` recomendado: `escola_k12 | centro_formacao`.
- Razão: evita duplicação de infraestrutura, facilita billing unificado e casos híbridos (escola + formação).
- Requisito: todas as tabelas novas devem manter `escola_id` (ou `tenant_id` consolidado) e políticas RLS estritas por tenant.
