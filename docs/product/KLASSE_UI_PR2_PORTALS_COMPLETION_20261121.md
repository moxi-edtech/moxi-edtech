# KLASSE · PR 2 — Fecho da padronização de identidade e mobile

**Base:** `main` com PRs #409 e #398 integradas; **escopo:** apenas apresentação, formulários e loading; os contratos operacionais continuam intactos. A branch desta entrega foi sincronizada com as novas fundações da #398 antes da integração.

## Matriz de cobertura funcional de PR 2

| Portal | Superfície verificada | Padronização nesta fase |
| --- | --- | --- |
| Aluno | Início/dashboard | Suspense fallback responsivo e acessível; respeita movimento reduzido; nenhum dado académico simulado |
| Professor | Planos de Aula (PR #409), Intervenções, Detalhes de Actividade, Calendário, Notas (shell apenas) | Inset comum de Alunos, tokens semânticos, skeletons com estrutura real, botões legíveis em mobile, link de retorno com texto |
| Secretaria | Dashboard e carregamento de widgets/modais | Skeletons com `role=status`, raios `xl`, cores adaptadas ao tema, movimento opcional; navegação e APIs mantidas |
| Admin | Configurações > Comunicação/WAHA | Campos vinculados aos rótulos, foco visível, superfície padronizada, QR adaptável sem rolagem lateral, com status e ações do provider intactos; sem alterar permissões/endpoint |
| Financeiro | Tabelas de mensalidades e preços | Margens e largura de referência, seleção de vistas com estado acessível e indicação visual, skeleton, tema; a URL e componentes de preços permanecem fonte da verdade |

### O que já estava padronizado e foi preservado

A PR de margens anteriores havia padronizado as páginas operacionais de Alunos, Turmas, Documentos, Admissões, Relatórios, Administração e Financeiro por meio de `PORTAL_PAGE_INSET`. Mantemos **a mesma referência** (`max-w-6xl px-6 py-8`) para evitar a regressão de margens e não alteramos os layouts específicos de impressão ou a largura ampla de Horários.

### Limites e risco residual

- **Não é uma certificação de todos os píxeis de todas as rotas**: páginas históricas e módulos com visuais específicos continuam com estilos locais. O critério deste lote é uniformizar as superfícies prioritárias e os componentes partilhados, sem reescrever centenas de fluxos ou duplicar lógica.
- **PR 3** cobre tabelas, filtros, paginação, empty states e datas/valores operacionais. Não antecipar operações bancárias, lançamento de notas, RAA nem RLS para esta fase.
- QA autenticado em 320/375/768/1440 px, zoom 200%, teclado e Safari/VoiceOver deve ser concluído antes de afirmar acessibilidade AA visual integral. A automação não substitui esse QA.
- A PR #398 alterou `Button` e `ModalShell` e foi integrada na `main` durante a validação. O gate conjunto de `ui-foundations` e PR 2 foi executado após a sincronização, sem alterar endpoints ou contratos públicos.

### Gates de implementação

- `pnpm -C apps/web typecheck`
- `pnpm -C apps/web exec eslint` nos ficheiros alterados
- `node --test --import tsx apps/web/tests/unit/ui-pr2-portals-completion.spec.tsx`
- `node --test --import tsx apps/web/tests/unit/ui-foundations.spec.ts apps/web/tests/unit/ui-identity-mobile.spec.tsx apps/web/tests/unit/portal-page-layout.spec.ts`
- `node scripts/check-klasse-ui-standards.mjs`
- `THEME_GUARD_BASE_REF=<baseSHA> node scripts/check-theme-switcher-colors.mjs`
- GitHub CI completo, sem checks pendentes, e revisão dos deltas da PR
