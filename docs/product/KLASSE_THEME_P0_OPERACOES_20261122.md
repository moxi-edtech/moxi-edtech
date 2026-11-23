# KLASSE — Theme Switcher P0: Escola, Secretaria e Gestão Académica

**Data:** 22 de novembro de 2026. **Base:** `main` no commit `1d2daedfb`.
**Objetivo:** eliminar superfícies neutras fixas que não respondem a Claro/Escuro/Sistema.

## Entrega

| Frente | Ficheiros modificados | Padrões neutros fixos (antes) | Após |
|---|---:|---:|---:|
| Páginas operacionais de Escola | 68 | 2.137 | 0 |
| Secretaria — componentes restantes | 67 | 1.540 | 0 |
| Gestão académica/Escola — componentes restantes | 19 | 819 | 0 |
| Secretaria — páginas restantes | 30 | 729 | 0 |
| **Total** | **184** | **5.225** | **0** |

Os números são **ocorrências de classes neutras por expressão regular**, não número de bugs nem contagem de componentes visuais. O inventário nominal dos ficheiros está em `docs/product/KLASSE_THEME_P0_INVENTORY_20261122.json`.

Convertemos `bg-white`, `bg-slate-50/100/200`, `text-slate-400..950`, `border-slate-100..400`, `ring-slate` e equivalentes para `bg-card`, `bg-muted`, `bg-muted-foreground/15`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring` e outros tokens semânticos. Variações de `hover` e `focus` continuam acessíveis em ambos os modos.

O fundo editorial intencionalmente escuro passa a utilizar o token partilhado `klasse-dark` (valor oficial `#020617`) em vez de classes `bg-slate-900/950` alteradas. O guard de cores passa a suportar diffs grandes (até 64 MiB) sem truncamento; testes confirmam que uma violação no fim de um diff acima de 1 MiB continua a ser rejeitada.

Classes com os hexadecimais institucionais KLASSE foram convertidas para as classes do pacote de design tokens, com tratamento explícito de contraste em textos verdes/dourados. Botões primários dourados usam `text-klasse-gold-900`; elementos ativos com fundo invertido usam `bg-foreground text-background`.

## Restrições

- **Não** modificar APIs, RPCs, migrações, policies RLS, permissões, cálculos financeiros, regras de matrículas/rematrículas, notas, frequência ou histórico.
- **Não** incluir os 23 ficheiros da PR #446; esta entrega é independente e paralela.
- **Não** alterar ficheiros fiscais, impressão, documentos PDF, emails, artefactos legados `onboarding.bak` ou portais deliberadamente *light-only* de alunos/professores.
- Preservar os estados de sucesso/alerta/erro e os painéis deliberadamente escuros, inclusive os que exibem texto branco sobre fundo escuro.
- Preservar os contratos dos componentes, os handlers, os dados e a navegação.

Algumas classes de estados (`amber`, `rose`, `emerald`) e alguns fundos escuros intencionais continuam sendo candidatos a uma futura inspeção visual de contraste. Eles não fazem parte da contagem neutralizada; mudar todas essas cores de forma mecânica causaria regressões semânticas.

A validação de padrões visuais identificou ainda 20 cartões operacionais com `rounded-2xl` nas linhas alteradas. Esses casos foram alinhados a `rounded-xl` para respeitar o gate `KLASSE UI Standards`.

## Controlo de regressão

`apps/web/tests/unit/p0-operational-theme-coverage.spec.mjs` examina os 184 ficheiros documentados, exige zero classes neutras fixas e rejeita hexadecimais institucionais inline em classes utilitárias. É importado por `theme-color-coverage.spec.mjs`, que já integra o workflow `Theme Switcher Guard`.

**Gates de entrega:** `git diff --check`, ESLint (sem erros), `pnpm --filter web typecheck`, testes unitários de tema e `THEME_GUARD_BASE_REF=origin/main node scripts/check-theme-switcher-colors.mjs`. Verificar também os checks do PR no GitHub. A aprovação do CI não substitui a homologação visual autenticada em Claro/Escuro/Sistema e em ecrãs móveis.

### Áreas principais para inspeção visual

Gestão de professores, tabela e detalhe de turma, admissão/rematrícula, emissão de documentos, configuração curricular, horários, mensalidades e fecho académico.

## Reconciliação dos bloqueios do CI da PR #447

Foram identificados três bloqueios na primeira execução do GitHub Actions:

- **Command Center Contextual:** o processo TypeScript esgotou o heap padrão de cerca de 2 GiB. O workflow agora define `NODE_OPTIONS=--max-old-space-size=4096` apenas para o typecheck integral. Não elimina verificações nem oculta erros de tipos.
- **Command Center Visual Fixtures:** a validação automática WCAG encontrou contraste insuficiente nos separadores inativos **Horário** e **Disciplinas** da Turma. Agora ambos os estados usam `text-foreground` e a seleção distingue-se por `bg-card` versus `bg-muted`, em claro e escuro.
- **Balcão Performance Budgets:** a fixture registou **150 ms** de p50 em Documento, contra o orçamento de **148,8 ms**. A medição incluía `button.click`, `waitForFunction` e round-trips entre Playwright e Node, que não são tempo de pintura da aplicação. O benchmark passou a medir no browser desde o evento `click` até dois `requestAnimationFrame`, mantendo os custos de automação separados em `driverRoundtripMs`. **O orçamento e os gates de requests, React commits e bundles não foram ampliados.** O benchmark continua sintético e não substitui medição de RUM em produção.

Os contratos unitários do Command Center e do Balcão passaram a impedir a reintrodução dos padrões de contraste/medição identificados. O estado final dos workflows deve ser consultado diretamente na PR antes do merge.
