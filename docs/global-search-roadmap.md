# Global Search — Multi-Entidade (Roadmap)

## Objetivo
Evoluir o Global Search para cobrir entidades críticas por portal, mantendo performance (p95 ≤ 300 ms) e consistência multi-tenant.

## Estado atual
- RPC: `public.search_global_entities` (cursor e filtros por tipo).
- Cobertura: Secretaria (alunos, matrículas, turmas, documentos), Financeiro (mensalidades, pagamentos, recibos) e Admin (professores, cursos, classes, usuários).
- UI: `GlobalSearch` + `useGlobalSearch` com `portal` e `types`.
- Debounce: 300ms (OK no range 250–400ms).

## Escopo por portal (entidades)
### Secretaria
- Alunos, matrículas, turmas, documentos.

### Financeiro
- Alunos, mensalidades, pagamentos, recibos.

### Admin Escola
- Turmas, professores, classes, cursos, usuários.

### Professor
- Turmas, disciplinas atribuídas, alunos.

### Aluno
- Disciplinas, notas recentes, documentos.

## Catálogo de entidades (campos mínimos)
- **Aluno**: `id`, `label` (nome), `highlight` (processo/BI), `href` `/secretaria/alunos/:id`
- **Matrícula**: `id`, `label` (aluno + turma), `highlight` (status), `href` `/secretaria/admissoes?matricula=:id`
- **Turma**: `id`, `label` (nome + classe), `highlight` (turno), `href` `/secretaria/turmas/:id`
- **Documento**: `id`, `label` (tipo + aluno), `highlight` (status), `href` `/secretaria/documentos?matricula=:id`
- **Mensalidade**: `id`, `label` (aluno + ref), `highlight` (status/valor), `href` `/secretaria/alunos/:aluno_id`
- **Pagamento**: `id`, `label` (aluno + valor), `highlight` (método), `href` `/secretaria/alunos/:aluno_id`
- **Recibo**: `id`, `label` (número + aluno), `highlight` (data), `href` `/financeiro?aluno=:aluno_id`
- **Professor**: `id`, `label` (nome), `highlight` (disciplina), `href` `/escola/[id]/admin/professores`
- **Curso**: `id`, `label` (nome), `highlight` (código), `href` `/escola/[id]/admin/configuracoes`
- **Classe**: `id`, `label` (nome), `highlight` (nível), `href` `/escola/[id]/admin/configuracoes`
- **Usuário**: `id`, `label` (nome/email), `highlight` (papel), `href` `/escola/[id]/admin/funcionarios`
- **Disciplina**: `id`, `label` (nome), `highlight` (classe/curso), `href` `/professor/notas?disciplina=:id`
- **Nota**: `id`, `label` (aluno + disciplina), `highlight` (trimestre), `href` `/professor/notas?aluno=:aluno_id`

## Contratos e regras
- SLA: p95 ≤ 300 ms (busca global).
- Limite máximo por consulta: 50.
- Ordenação determinística (score, updated_at, created_at, id).
- RLS obrigatório ou `SECURITY DEFINER` com `current_tenant_escola_id()`.
- Sem cache persistente em portais críticos (secretaria/financeiro/relatórios).

## Metas p95 por cenário de busca
- Query curta (1–2 termos): p95 ≤ 250 ms.
- Query longa (3+ termos): p95 ≤ 300 ms.
- Resultados com múltiplas entidades: p95 ≤ 300 ms com `limit <= 50`.
- Paginação/"carregar mais": p95 ≤ 300 ms (cursor determinístico).

## Desenho técnico (proposta)
### 1) RPC unificada
`search_global_entities(p_escola_id, p_query, p_types[], p_limit, cursor...)`.
- Retorno: `id, type, label, highlight, score, updated_at, created_at, href`.
- Filtra por `p_types` com limites por entidade.

### 2) Views por entidade
Criar `vw_search_*` para normalizar campos e ranking:
- `vw_search_alunos`
- `vw_search_turmas`
- `vw_search_professores`
- `vw_search_mensalidades`
- `vw_search_pagamentos`
- `vw_search_documentos`
- `vw_search_disciplinas`

### 3) Índices e performance
- `GIN` para `tsvector` de pesquisa.
- `btree` em `escola_id`, `updated_at`, `created_at`.
- `pg_trgm` para similaridade (já usado em alunos).

### 4) Client-side
- `useGlobalSearch` aceita `types` por portal.
- Mapper de `type -> href` por contexto.
- Limite inicial 8–10, “carregar mais” até 50.

## Roadmap detalhado
### P0 — Fundação (2–3 dias)
- Definir entidades por portal e contrato de payload.
- Descrever RPC unificada e formatos de retorno.
- Criar doc de mapeamento (UI → API → DB) por portal.

### P0.1 — Prioridade de entidades
- **P1**: Alunos, Turmas, Matrículas (Secretaria)
- **P2**: Mensalidades, Pagamentos, Recibos (Financeiro)
- **P3**: Professores, Cursos, Classes, Usuários (Admin)
- **P4**: Disciplinas, Notas (Professor/Aluno)

### P1 — Infra de busca (5–7 dias)
- Criar views `vw_search_*` com schema padronizado.
- Implementar `search_global_entities` com filtros e cursor.
- Índices/tsvector/trgm por entidade.

### P2 — Integração por portal (5–8 dias)
- `useGlobalSearch` recebe `types` por portal.
- Ajustar UI para mostrar tipo/atalhos.
- QA de performance (p95 ≤ 300 ms) e regressões.

### P3 — UX avançado (opcional)
- Sugestões sem query (recentes).
- Ações rápidas contextuais.
- Destaque de pendências (ex.: aluno inadimplente).

## Riscos
- RLS inconsistente em tabelas legadas.
- Payload excessivo se não houver limite por entidade.
- Score não determinístico sem ordenação final.

## Rotas sugeridas (gaps)
### P1
- `GET /secretaria/matriculas/:id` — detalhe de matrícula (hoje redireciona).
- `GET /secretaria/documentos/:id` — detalhe de documento (hoje só listagem).

### P2
- `GET /financeiro/mensalidades/:id` — detalhe de mensalidade.
- `GET /financeiro/pagamentos/:id` — detalhe de pagamento.

### P3
- `GET /escola/[id]/admin/usuarios/:id` — detalhe de usuário (hoje `/admin/funcionarios`).

## Sucesso
- Cobertura por portal implementada.
- P95 ≤ 300 ms em busca global.
- Erros zero de multi-tenant.

## Sessão atual — evidências
- Metas p95 reforçadas e alinhadas com `ROADMAP.md`.
- Nenhuma alteração funcional direta na busca global nesta sessão.

---

## Referências
- `agents/specs/performance.md`
