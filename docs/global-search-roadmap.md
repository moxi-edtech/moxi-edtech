# Global Search — Multi-Entidade & Ações Rápidas

## Objetivo
Motor de busca centralizado e orientado a ação, mantendo performance (p95 ≤ 150 ms) e consistência multi-tenant, com suporte a busca semântica e tolerância a erros.

## Estado atual (Evoluído)
- **RPC:** `public.search_global_entities` (com suporte a `unaccent`, `pg_trgm` e cursor determinístico).
- **Cobertura:** 
  - **Secretaria:** Alunos, Matrículas, Turmas, Documentos, **Candidaturas**.
  - **Financeiro:** Mensalidades, Pagamentos, Recibos.
  - **Admin:** Professores, Cursos, Classes, Usuários.
- **Busca Semântica:** Detecção de intenção via keywords (`pagar`, `cobrar`, `nota`, `doc`).
- **UX:** `CommandPalette` com badges de status, ícones contextuais e atalhos de ação.
- **Performance:** Índices GIN Trigram e remoção de subqueries redundantes (confiança no RLS).

## Escopo por portal (entidades)
### Secretaria
- Alunos, matrículas, turmas, documentos, candidaturas.

### Financeiro
- Alunos, mensalidades, pagamentos, recibos.

### Admin Escola
- Turmas, professores, classes, cursos, usuários.

## Capacidades de Busca (Nível Google)
- **Unaccent:** Busca insensível a acentos (ex: "Joao" encontra "João").
- **Fuzzy Search:** Tolerância a pequenos erros ortográficos via similaridade de trigramas (limiar 0.15–0.2).
- **Tokenização:** Busca por qualquer parte do nome (sobrenomes, meio do nome).
- **Ranking:** Ordenação por score de relevância, priorizando correspondências exatas e início de string.

## Detecção de Intenção (Keywords)
| Keyword | Intenção | Ação Resultante |
| :--- | :--- | :--- |
| `pagar`, `cobrar`, `fatura` | Financeiro | Redireciona para pagamentos/cobranças do aluno. |
| `nota`, `pauta`, `boletim` | Acadêmico | Prepara contexto para visualização de notas. |
| `doc`, `arquivo` | Documentos | Redireciona para a pasta de documentos do aluno. |
| `ver`, `perfil` | Perfil | Foca na navegação padrão para o detalhe da entidade. |

## Desenho técnico
### 1) RPC unificada
`search_global_entities(p_escola_id, p_query, p_types[], p_limit, cursor...)`.
- Utiliza `public.unaccent()` na query e nos campos de busca.
- Ranking via `greatest(ts_rank, similarity)`.

### 2) Views por entidade
Views padronizadas em `public.vw_search_*` que expõem:
- `id`, `type`, `label`, `highlight` (status/badge), `search_text`, `updated_at`, `created_at`.

### 3) Índices e performance
- `GIN` em `nome_completo` e `search_text` (trgm).
- `GIN` em `tsv` (`tsvector`) para busca de texto completo.
- Segurança garantida via **RLS (Row Level Security)** em vez de subqueries manuais.

## Metas de Performance (SLA)
- **Query Simples:** p95 ≤ 100 ms.
- **Query com Intenção:** p95 ≤ 150 ms.
- **Carga Máxima:** 50 resultados com paginação via cursor.

## Sucesso
- [x] Busca insensível a acentos implementada.
- [x] Detecção de intenção no frontend.
- [x] Badges de status na UI.
- [x] Entidade 'Candidaturas' incluída.
- [x] Performance otimizada (sub-150ms).
