# KLASSE Formação — Índice de Documentação

Última atualização: 2026-04-12

## 1) Documentos centrais (produto)

| Documento | Tipo | Foco |
|---|---|---|
| [`docs/ROADMAP_FORMACAO_INSCRICOES.md`](./ROADMAP_FORMACAO_INSCRICOES.md) | Roadmap | Inscrições, matrículas, fases e pendências reais |
| [`docs/REPORT_IMPLEMENTATION_FORMACAO_SALES_FUNNEL.md`](./REPORT_IMPLEMENTATION_FORMACAO_SALES_FUNNEL.md) | Relatório de implementação | Funil comercial e admissões ponta a ponta |

## 2) Arquitetura (Formação)

| Documento | Tipo | Foco |
|---|---|---|
| [`docs/architecture/multi-product-k12-formacao.md`](./architecture/multi-product-k12-formacao.md) | Arquitetura | Separação de produto `apps/web` vs `apps/formacao`, host, tenant e middleware |
| [`docs/architecture/super-admin-centros-formacao.md`](./architecture/super-admin-centros-formacao.md) | Arquitetura operacional | Provisionamento de centros de formação e modelo de dados |

## 3) Operação e governança (Formação)

| Documento | Tipo | Foco |
|---|---|---|
| [`agents/outputs/FORMACAO_TAXONOMY_CACHE_POLICY_2026-04-07.md`](../agents/outputs/FORMACAO_TAXONOMY_CACHE_POLICY_2026-04-07.md) | Política operacional | Taxonomia de rotas críticas, cache e MVs obrigatórias |
| [`agents/outputs/VALIDACAO_UI_FORMACAO_2026-04-08.md`](../agents/outputs/VALIDACAO_UI_FORMACAO_2026-04-08.md) | Auditoria UI | Aderência do módulo Formação ao design system e gaps |
| [`AGENTS.md`](../AGENTS.md) | Contrato de engenharia | Aditamento Ticket 5 para Formação (cache + MVs) |

## 4) Changelogs relacionados

| Documento | Escopo | Nota |
|---|---|---|
| [`CHANGELOG.md`](../CHANGELOG.md) | Repositório | Contém entrada explícita de Formação em `2026-04-11` |
| [`docs/pop/admin/CHANGELOG.md`](./pop/admin/CHANGELOG.md) | POP Admin | Não traz entradas explícitas do app Formação (foco em POP/Admin geral) |

## 5) Como localizar rápido

- Palavras-chave úteis: `formacao`, `cohort`, `inscricoes`, `centros-formacao`, `sales funnel`.
- Busca recomendada:
  - `rg -n -i "formacao|cohort|inscricoes|centros-formacao" docs agents/outputs CHANGELOG.md AGENTS.md`
  - `rg --files | rg -i "FORMACAO|formacao|changelog"`
