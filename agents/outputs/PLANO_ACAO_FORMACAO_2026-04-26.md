# Plano de Ação — KLASSE Formação
data: 2026-04-26  
base: varredura profunda do estado atual do módulo Formação

## Objetivo
Eliminar riscos críticos de segurança e alinhar o módulo Formação ao contrato de performance (MVs/wrappers), sem quebrar os fluxos atuais de inscrição, faturação e backoffice.

## Prioridades
| Prioridade | Tema | Status atual | Bloqueia escala |
|---|---|---|---|
| P0 | Segurança inscrição corporativa B2B | Concluído (2026-04-26) | Sim |
| P0 | Concorrência de quota B2B | Concluído (2026-04-26) | Sim |
| P1 | Dashboards usando tabela direta em vez de `vw_formacao_*` | Concluído (2026-04-26) | Sim |
| P1 | Endpoint público legado de inscrição | Concluído (2026-04-26) | Sim |
| P2 | Backoffice `(formacao-backoffice)` placeholder | Concluído (2026-04-26) | Não imediato |
| P2 | Padronização explícita de cache em rotas restantes | Concluído (2026-04-26) | Não imediato |

## Plano de Execução

## Fase P0 — Segurança e Integridade (imediata)
### Tarefa P0.1 — Validar token/escopo no fluxo corporativo
Arquivos:
- `apps/formacao/app/api/formacao/publico/inscrever-corporativo/route.ts`

Ações:
- Exigir token corporativo no payload/header.
- Validar token contra `formacao_contratos_b2b.b2b_token`.
- Validar vínculo `contrato_id -> escola_id -> cohort_id`.
- Rejeitar inscrição se qualquer vínculo não for consistente.

Critérios de aceite:
- Requisição sem token retorna `401/403`.
- Token inválido retorna `403`.
- Contrato de outra escola/cohort retorna `403`.
- Testes de fluxo feliz e negação adicionados.

Status de execução:
- Concluída em 2026-04-26.
- Endpoint corporativo passou a exigir `b2b_token` e validar `id + b2b_token`.
- Validação de escopo aplicada (`contrato.escola_id/cohort_id` precisa casar com a requisição).
- Frontend corporativo atualizado para enviar token da URL.

### Tarefa P0.2 — Tornar consumo de vagas atômico
Arquivos:
- `supabase/migrations/*_formacao_b2b_*.sql` (nova migration)
- `apps/formacao/app/api/formacao/publico/inscrever-corporativo/route.ts`

Ações:
- Criar RPC transacional para: validar quota + reservar vaga + registrar inscrição.
- Remover padrão `read-then-update` da API.
- Garantir idempotência por chave de operação (quando aplicável).

Critérios de aceite:
- Em concorrência, não excede `vagas_compradas`.
- Fluxo falha com erro de negócio previsível quando quota esgota.
- Auditoria mínima de operação registrada.

Status de execução:
- Concluída em 2026-04-26.
- Migration criada com RPC transacional atômica:
  - `supabase/migrations/20270426093000_formacao_b2b_atomic_enrollment.sql`
  - função `public.formacao_corporate_enroll_atomic(...)` com lock `FOR UPDATE`, verificação de quota e incremento seguro de `vagas_utilizadas`.
- API corporativa passou a usar a RPC atômica no lugar de `read-then-update`.

## Fase P1 — Performance e Contrato Operacional
### Tarefa P1.1 — Migrar dashboards para wrappers `vw_formacao_*`
Arquivos:
- `apps/formacao/app/(portal)/financeiro/dashboard/page.tsx`
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx`

Ações:
- Substituir leitura de tabelas operacionais por:
  - `vw_formacao_cohorts_lotacao`
  - `vw_formacao_inadimplencia_resumo`
  - `vw_formacao_margem_por_edicao`
- Manter fallback controlado apenas para indisponibilidade de view.

Critérios de aceite:
- Dashboards não consultam mais `formacao_faturas_lote*` para KPI agregado.
- KPIs batem com o resultado das views.
- Sem regressão visual/funcional nas páginas.

Status de execução:
- Concluída em 2026-04-26.
- `admin/dashboard` migrou para `vw_formacao_cohorts_overview` + `vw_formacao_cohorts_lotacao`.
- `financeiro/dashboard` migrou para `vw_formacao_inadimplencia_resumo` + `vw_formacao_margem_por_edicao`.

### Tarefa P1.2 — Encerrar endpoint público legado
Arquivos:
- `apps/formacao/app/api/formacao/publico/inscrever/route.ts`
- `apps/formacao/app/api/formacao/admissoes/route.ts`

Ações:
- Redirecionar ou descontinuar o endpoint legado.
- Consolidar fluxo público no self-service baseado em `centro_slug + cohort_ref`.
- Evitar aceite direto de `escola_id/cohort_id` do cliente.

Critérios de aceite:
- Apenas um fluxo público oficial ativo.
- Endpoint legado responde `410` ou delega com validação forte.
- Documentação atualizada com endpoint canônico.

## Fase P2 — Completude de Produto e Padronização
### Tarefa P2.1 — Implementar páginas do backoffice unificado
Arquivos:
- `apps/web/src/app/(formacao-backoffice)/formacao/cohorts/page.tsx`
- `apps/web/src/app/(formacao-backoffice)/formacao/cohorts/[cohort_id]/*/page.tsx`

Ações:
- Conectar páginas placeholder às APIs existentes de formação.
- Exibir dados reais (cohort, formandos, sessões, materiais, certificados).
- Aplicar estados de loading/empty/error padronizados.

Critérios de aceite:
- Telas deixam de ser estáticas.
- Navegação completa e funcional no fluxo backoffice.
- Cobertura mínima de testes de renderização/dados.

Status de execução:
- Concluída em 2026-04-26.
- Páginas conectadas a dados reais:
  - `formacao/cohorts` (tabela `formacao_cohorts` + MVs `vw_formacao_cohorts_lotacao` e `vw_formacao_margem_por_edicao`)
  - `formacao/cohorts/[cohort_id]/overview`
  - `formacao/cohorts/[cohort_id]/formandos`
  - `formacao/cohorts/[cohort_id]/sessoes` (base operacional via `formacao_honorarios_lancamentos`)
  - `formacao/cohorts/[cohort_id]/materiais` (snapshot curricular via `formacao_cohort_modulos`)
  - `formacao/cohorts/[cohort_id]/certificados`

### Tarefa P2.2 — Padronização de cache explícita
Arquivos:
- `apps/formacao/app/api/formacao/pagamentos/comprovativo/route.ts`
- `apps/formacao/app/api/formacao/publico/revalidate/route.ts`
- demais rotas de formação sem `dynamic` explícito

Ações:
- Declarar `export const dynamic = 'force-dynamic'` nas rotas operacionais.
- Revisar política de cache para alinhamento contratual.

Critérios de aceite:
- 100% das rotas críticas com política explícita.
- Nenhuma rota operacional com comportamento ambíguo de cache.

Status de execução:
- Concluída em 2026-04-26.
- Rotas ajustadas: `api/formacao/pagamentos/comprovativo` e `api/formacao/publico/revalidate`.
- Varrimento final sem rotas `app/api/formacao/**/route.ts` sem `dynamic = "force-dynamic"`.

## Plano de Testes
| Camada | Teste | Meta |
|---|---|---|
| Unit | validações de token/quota + guardrail endpoint legado | Cobrir cenários de negação/sucesso e prevenir regressão |
| Integração | inscrição B2B concorrente | Garantir não estourar quota |
| Integração | dashboards com `vw_*` | Garantir KPI consistente |
| Regressão | `pnpm --filter formacao test:unit:context` e `typecheck` | 100% verde |

## Sequência recomendada de execução
1. P0.1 ✅
2. P0.2 ✅
3. P1.2 ✅
4. P1.1 ✅
5. P2.2 ✅
6. P2.1 ✅

## Backlog Remanescente
- Executar testes de integração de concorrência B2B (carga/paralelismo) para evidência operacional.
- Executar validação de consistência de KPI entre dashboards e `vw_formacao_*` em ambiente com dados reais.
- Reemitir relatório final de varredura para fechamento formal (`REPORT_SCAN`/gate sem blockers).

## Critério de fechamento
- P0 e P1 concluídos e validados.
- Sem finding bloqueante aberto no escopo Formação.
- Relatório de varredura reemitido após apply confirmando status.
