# Polimento UX — Explorador de Classe (Command Center)

**Registo:** 22/10/2026 · **Âmbito:** apenas frontend · **Branch:** `polish/classe-explorer-ux-20261022`

Complemento pontual à [auditoria dos exploradores](./command-center-exploradores-auditoria-20261022.md). **Não** altera API, SQL, RLS nem banco de dados.

## Ficheiro alterado

- `apps/web/src/components/secretaria/command-center/ClasseContextView.tsx`

## O que foi feito (UI/UX)

| Achado da auditoria | Alteração no explorador de Classe |
| --- | --- |
| **DATA-01** — «Vagas totais definidas» confundia capacidade com vagas disponíveis | Indicadores separados: **Alunos matriculados**, **Capacidade**, **Vagas disponíveis**. Capacidade desconhecida mostra «Não definida» (nunca zero inventado). **Excedente de lotação** só aparece quando ocupação > capacidade. |
| Ocupação por turma | Cada linha de turma mostra alunos · capacidade · vagas / lotada / excedente, calculado no cliente a partir dos dados já devolvidos pela API. |
| Turmas sem alunos | Indicador leve «Sem alunos neste ano» e resumo no topo, sem inventar pendências de docente/horário. |
| **LINK-01** — CTA genérico | Rótulo **Abrir gestão académica** (destino real: módulo de configurações). `title` explica que não executa alterações no explorador. |
| Acessibilidade leve | `aria-labelledby` nas secções, `aria-live` na contagem/paginação de alunos, `aria-hidden` em ícones decorativos, `focus-visible` consistente. |
| Linguagem | Rótulos em português de Angola alinhados ao glossário da auditoria (`turma`, `classe`, `matrícula`, `ano letivo`). |

## O que **não** foi feito (fora de escopo desta branch)

- Nenhuma migration, RPC, RLS ou endpoint.
- Continuidade P0 Turma → Balcão → Turma (UX-00) — tratada noutro trabalho.
- SEC-01 / PRIV-01 / PRIV-02.
- Pesquisa de aluno no escopo da classe no banco (paginação SQL).
- Virtualização de listas ou redesign do design system de Metric.
- Breadcrumb global do modal (BREAD-01) e scroll único do shell (SCROLL-01) — partilhados com os outros exploradores.

## Critério de verificação manual

1. Abrir uma classe com turmas de capacidade mista: métricas de capacidade/vagas coerentes; turmas sem capacidade não forçam vagas = 0.
2. Classe com turma lotada ou com excedente: rótulos «Lotada» / «Excedente N» visíveis.
3. CTA «Abrir gestão académica» leva ao módulo de configurações com o ano letivo preservado.
4. Paginação de alunos anuncia a página actual; foco visível nos botões.

## Relação com PRs abertas

- Auditoria documental: PR #233.
- Pacote operacional P0 (continuidade + SEC): PR #234 — pode absorver ou reaplicar este polimento de Classe se a branch divergir.
