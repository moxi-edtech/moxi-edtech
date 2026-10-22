# Polimento UX — Exploradores e shell do Command Center (KLASSE)

**Registo:** 22/10/2026 · **Âmbito:** apenas frontend · **Branch:** `polish/classe-explorer-ux-20261022`

Complemento à [auditoria dos exploradores](./command-center-exploradores-auditoria-20261022.md).
**Não** altera API, SQL, RLS nem banco de dados.

## Ficheiros

### Exploradores (métricas, CTAs, ocupação)
- `ClasseContextView.tsx`, `TurmaContextView.tsx`, `CourseContextView.tsx`
- `DisciplinaContextView.tsx`, `ProfessorContextView.tsx`

### Shell / pesquisa / privacidade / mobile
- `hooks/useGlobalSearch.ts` — PRIV-01/02, SRCH-01/02
- `components/CommandPalette.tsx` — BREAD-01, A11Y fechar, SRCH UI, KBD rodapé
- `components/layout/klasse/Topbar.tsx` — MOB-01

## Mapa auditoria → alteração

| ID | Estado nesta branch |
| --- | --- |
| **DATA-01** | Capacidade ≠ vagas nos exploradores Classe/Turma/Curso |
| **NAV-02** | Curso: clique na turma abre contexto |
| **LINK-01** | CTAs honestos nos exploradores |
| **PRIV-01 / PRIV-02** | Recentes só em memória de sessão; sem BI/processo; limpa chave legada do `localStorage` |
| **MOB-01** | Ícone de pesquisa no mobile abre o mesmo CommandPalette (controlado) |
| **SRCH-01** | Botão «Ver mais resultados» quando `hasMore` |
| **SRCH-02** | Estado de erro distinto de lista vazia + retry |
| **BREAD-01** | Breadcrumb `Pesquisa / … / actual` com navegação por passo |
| **A11Y-01** (parcial) | Botão fechar explícito na pesquisa e no contexto |
| **KBD-01** (parcial) | Rodapé só anuncia Esc / ⌘K / setas quando aplicável |
| **SCROLL-01** (parcial) | Vista contextual com `max-h` e um scroll principal |
| **UX-00** | Ainda incompleto: handoff Balcão não restaura página/filtro/scroll da turma |
| **SEC-01** | Fora de escopo (banco) |

## Pendente sem backend (próximos passos front)

1. **UX-00 completo:** `returnContext` em sessão ao abrir aluno do explorador; ao fechar o Balcão, reabrir CommandPalette na mesma turma/página.
2. **NAV-03:** sincronizar «Todas as classes» com callbacks do palette.
3. **A11Y-01 completo:** focus trap / foco inicial formal no dialog (cmdk cobre parte).
4. **DS-01:** componente `Metric` partilhado.

## Verificação rápida

1. Mobile: ícone de lupa abre pesquisa; desktop mantém campo.
2. Recentes: não sobrevivem a novo separador / outro utilizador no mesmo browser após fechar a aba.
3. Pesquisa com erro de rede: mensagem + retry, não lista vazia silenciosa.
4. Mais de 8 resultados: «Ver mais resultados».
5. Navegação Curso → Classe → Turma: breadcrumb permite voltar a qualquer passo.
