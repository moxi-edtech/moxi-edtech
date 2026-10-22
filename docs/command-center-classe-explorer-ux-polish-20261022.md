# Polimento UX — Command Center KLASSE (frontend only)

**Registo:** 22/10/2026 · **Branch:** `polish/classe-explorer-ux-20261022`

Sem API, SQL, RLS ou banco. Complemento à [auditoria](./command-center-exploradores-auditoria-20261022.md).

## Entregue nesta branch

| ID | Entrega |
| --- | --- |
| **DATA-01** | Capacidade ≠ vagas (Classe, Turma, Curso) |
| **NAV-02** | Curso: clique na turma abre contexto |
| **LINK-01** | CTAs honestos nos exploradores |
| **PRIV-01/02** | Recentes em memória de sessão; sem BI/processo; limpa `localStorage` legado |
| **MOB-01** | Pesquisa no mobile; uma `CommandPalette` controlada |
| **SRCH-01** | «Ver mais resultados» |
| **SRCH-02** | Erro ≠ vazio + retry |
| **BREAD-01** | Breadcrumb navegável |
| **A11Y** | Fechar explícito |
| **UX-00** | Ao abrir aluno a partir do explorador, ao fechar o Balcão reabre o mesmo contexto (sessão) |
| **KBD** | Rodapé só com atalhos reais |

## Ficheiros principais

- Exploradores: `Classe|Turma|Course|Disciplina|ProfessorContextView.tsx`
- `hooks/useGlobalSearch.ts`
- `components/CommandPalette.tsx`
- `components/layout/klasse/Topbar.tsx`
- `lib/command-center/explorer-return-context.ts`

## Fora de escopo (backend / outro PR)

- **SEC-01** autorização RPC
- **PERF-01** agregações SQL
- **PRINT-01** export com auditoria
- Página de alunos dentro da turma (paginação SQL)
- DS-01 Metric partilhado (opcional)

## Verificação

1. Turma → aluno → Balcão → fechar → volta à turma no Command Center.
2. Mobile: ícone lupa abre pesquisa.
3. Recentes não sobrevivem a novo separador.
4. Capacidade mista → vagas / excedente legíveis.

## Consolidação com PR #234 — backlog único (22/10/2026)

A implementação de UX da branch `polish/classe-explorer-ux-20261022` foi incorporada por ficheiro na branch `feat/command-center-operational-p0-20261022`, que também mantém a migração SQL e os testes de segurança. A PR #235 foi aberta apenas para diagnóstico do conflito; **a PR #234 é a frente integradora**.

| ID | Código | Validação | Próximo gate |
| --- | --- | --- | --- |
| UX-00 | Integrado do polish | Pendente E2E autenticado | 3 atendimentos consecutivos; página/filtro/scroll/foco; escola/ano alterados |
| DATA-01, NAV-02, LINK-01 | Integrados do polish | CI pendente | Conferir dados e destinos por papel |
| PRIV-01/02 | Integrados do polish | CI pendente | Logout/login em computador partilhado; BI/processo ausentes |
| MOB-01, SRCH-01/02 | Integrados do polish | CI pendente | Mobile real, paginação, erro, retry e resultados obsoletos |
| BREAD-01, A11Y-01, KBD-01 | Integrados do polish | CI pendente | Teclado, foco, Escape, leitores de ecrã |
| SEC-01 | Migration versionada em PR #234 | Teste sintético criado; teste autenticado pendente | Perfis e duas escolas, RPC direta; aplicar via rollout controlado |
| PERF-01 | Pendente | Pendente | Paginação/agregação SQL e medição p95 |
| PRINT-01 | Pendente | Pendente | Export autorizado e auditado |
| DS-01, LANG-01, MOTION-01, OBS-01 | Pendente | Pendente | Consistência, glossário PT-AO, latência e correlação |

**Não homologado ≠ entregue em produção.** Nenhuma alteração de banco deve ser aplicada apenas porque o frontend foi consolidado.

### UX-00 — implementação de retorno contextual

O snapshot efémero inclui agora estado por explorador (`tipo:id`): página, posição de leitura e aluno selecionado. Turma e Classe restauram a página ao remontar, scroll após carregamento e foco na linha do aluno quando ainda existir na página. O estado é consumido ao regressar do Balcão e o cache contextual é invalidado. Sem persistência em `localStorage`.

**Verificação pendente:** executar CI no HEAD e homologar com 45+ alunos, três atendimentos, mudança de turma/ano e escola, sessão expirada, ordenação e filtros quando existirem. O mecanismo não implementa filtros/ordenação ainda indisponíveis na UI. Não marcar como homologado antes desses testes.
