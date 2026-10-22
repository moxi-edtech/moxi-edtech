# Polimento UX — Exploradores do Command Center (KLASSE)

**Registo:** 22/10/2026 · **Âmbito:** apenas frontend · **Branch:** `polish/classe-explorer-ux-20261022`

Complemento à [auditoria dos exploradores](./command-center-exploradores-auditoria-20261022.md).
**Não** altera API, SQL, RLS nem banco de dados.

## Ficheiros alterados

| Explorador | Ficheiro |
| --- | --- |
| **Classe** | `apps/web/src/components/secretaria/command-center/ClasseContextView.tsx` |
| **Turma** | `apps/web/src/components/secretaria/command-center/TurmaContextView.tsx` |
| **Curso** | `apps/web/src/components/secretaria/command-center/CourseContextView.tsx` |
| **Disciplina** | `apps/web/src/components/secretaria/command-center/DisciplinaContextView.tsx` |
| **Professor** | `apps/web/src/components/secretaria/command-center/ProfessorContextView.tsx` |

## Mapa auditoria → alteração

| ID | Onde | O que mudou na UI |
| --- | --- | --- |
| **DATA-01** | Classe, Turma, Curso | Capacidade ≠ vagas. Indicadores separados: alunos, capacidade, vagas disponíveis; excedente só quando ocupação > capacidade; «Não definida» quando capacidade ausente (nunca zero inventado). |
| **NAV-02** | Curso | Clique na linha da turma abre **directamente** o contexto da turma; «Abrir página» permanece secundário. |
| **LINK-01** | Classe, Disciplina, Professor, Turma | CTAs honestos: «Abrir gestão académica», «Abrir gestão de professores», «Abrir página da turma» + `title` que descreve o destino real. |
| Estados verificáveis | Classe, Turma, Disciplina, Professor | Turmas sem alunos; disciplinas/turmas sem professor; professor sem atribuição vs sem horário publicado (distintos). Sem inventar pendências de fontes não confiáveis. |
| A11y leve | Todos | `aria-labelledby` nas secções, `aria-live` em paginação/contagens, `aria-hidden` em ícones, `focus-visible` consistente. |
| Linguagem | Todos | Rótulos PT-AO alinhados (`turma`, `classe`, `matrícula`, `ano letivo`). |

## O que **não** foi feito (fora de escopo)

- Continuidade P0 Turma → Balcão → Turma (**UX-00**) — PR #234 / outro trabalho.
- **SEC-01** / **PRIV-01** / **PRIV-02** (autorização RPC, recentes).
- Paginação/pesquisa de alunos no SQL; virtualização de listas.
- Breadcrumb global do modal (**BREAD-01**) e scroll único do shell (**SCROLL-01**).
- Redesign do design system de Metric (**DS-01**).
- Mobile Command Palette (**MOB-01**).

## Critérios de verificação manual

1. **Classe / Turma:** capacidade mista → vagas coerentes; sem capacidade → «Não definida»; lotada / excedente legíveis.
2. **Curso:** um clique na turma abre o explorador de turma; ocupação na linha; «Abrir página» separado.
3. **Disciplina:** turmas sem docente assinaladas; CTA abre gestão, não promete atribuição.
4. **Professor:** sem atribuição ≠ sem horário publicado; CTA abre gestão de professores.
5. Teclado: foco visível; paginação de alunos anuncia página actual.

## Relação com PRs abertas

- Auditoria documental: PR #233.
- Pacote operacional P0 (continuidade + SEC): PR #234 — pode reaplicar ou absorver este polimento se divergir.
