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
