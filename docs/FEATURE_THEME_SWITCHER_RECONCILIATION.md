# Reconciliação do Theme Switcher — 2026-10-25

Origem: `feat/theme-switcher`. Reconciliada a partir da `main` (`2f51880ce93e5ec78562f66d8a7ff33755caf194`) numa nova branch, sem forçar rebase da origem.

## Decisões
- **Decisão de produto corrigida:** o `ModuleSwitcher` foi removido deliberadamente para o próximo deploy. A reconciliação não deve reintroduzi-lo. Preservar pesquisa, Command Center e fluxos do Balcão, sem preservar o seletor de módulos.
- Aproveitar os tokens `:root` / `.dark` / `@custom-variant dark` já existentes no CSS.
- Oferecer light, dark e system; persistir por navegador em `klasse-theme`, com leitura retrocompatível de `theme`.
- Provider local, sem `next-themes`: a branch antiga acrescentou a dependência mas não atualizou `pnpm-lock.yaml`, incompatível com installs congeladas.
- Bootstrap antes do paint, com `suppressHydrationWarning` já no RootLayout.
- Alternador na Topbar e escolha acessível Claro/Escuro/Sistema no menu do utilizador (teclado: setas/Home/End), em desktop e mobile; sem alterações de autenticação, permissões, RPC ou pagamentos.
- Em `theme-print.css` (`@media print`), tokens semânticos e `color-scheme` são forçados a claro; impressão/PDF reais continuam a exigir homologação autenticada.

## Escopo já integrado
- Fundamentos: RootLayout, ThemeProvider, ThemeToggle, bootstrap pré-paint, preferência tipada, testes unitários e workflow `Theme Switcher Guard`.
- Shell: Topbar, fundo principal de AppShell; **ModuleSwitcher removido** tanto do Topbar como do antigo PortalLayout. A sidebar mantém o padrão escuro institucional nos dois temas.
- Admin/Operações: dashboard académica, KPIs, cards, atalhos, painéis operacionais e gráficos usam tokens semânticos; eixos dos gráficos seguem `--muted-foreground` / `--border`.
- Financeiro: geração e registo de pagamentos, validações, tabelas de mensalidades e listas com modais scrolláveis no viewport móvel.
- Super Admin: rede de escolas, utilizadores, filtros, tabelas, diálogos de confirmação e cobrança convertidos para cores adaptativas.
- Partilhados: Card, KpiCard, SecondaryAction, TaskList, DashboardHeader, Button, Drawer, ModalShell, StatusPill, Alert, Sheet, Input, Select e notificações.
- Secretaria: AlunosList, ProfessoresList, ClassesList, ImportacoesList, MatriculasList, AlunoProfilePanel, PagamentoModal, BalcaoServicoModal, FilaAtendimentoModal, MinhaProdutividade e FechoCaixaCego.
- Relatórios: TabFluxo, TabPropinas, TabCaptacao (apenas classes visuais; lógica e consultas intactas).
- Portal do aluno: BottomNav.
- Command Center: CommandPalette, CommandCenterShell e CommandCenterPanel (apenas classes visuais, sem alteração de comandos nem permissões).
- Sem migrations, mudanças de auth, alterações financeiras ou refactors funcionais antigos.

## Exclusões intencionais
- O `ModuleSwitcher` **foi removido por decisão de produto**, portanto os seus dois pontos de renderização e o módulo legado foram eliminados. O ThemeSwitcher não substitui a navegação entre módulos.
- `PagamentoDividaModal` e fluxos de impressão/recibo: aguardar teste visual/print antes de retematizar.
- Wizards grandes do Balcão/Admissão e restantes portais: dívida de cobertura visual; evitar sobrescrever melhorias recentes com snapshots antigos.
- Nenhuma dependência `next-themes` ou modificação do lockfile; o provider local é autocontido.

## Validação
- `Theme Switcher Guard`: testes de preferência light/dark/system e contraste CSS RGB/OKLCH.
- `Portal Visual Fixture Screenshots`: Playwright em fixture isolada verifica os controlos reais, persistência, system, contraste e impressão; screenshots sintéticas de ambos os temas.
- O contraste das fixtures passou a calcular a luminância a partir de OKLCH, em vez de interpretar números OKLCH incorretamente como RGB.
- `KF2 Search Audit`: garantir nenhum hexadecimal de marca introduzido em novas linhas operacionais.
- `module-switcher-removal.spec.mjs`: impede regressão que volte a importar/renderizar ModuleSwitcher no Topbar ou PortalLayout; garante que ThemeSwitcher permanece acessível.
- `admin-theme-coverage.spec.mjs`: protege superfícies administrativas contra reintrodução de branco fixo e texto neutro ilegível, verifica altura/scroll de modais, rótulos de campos e contraste das ações douradas.
- Gates de CI gerais e homologação autenticada continuam obrigatórios antes de tirar a PR do modo draft.


## Pendências antes de release
- Convertidos formulários, cartões de pagamentos, listagem, geração e edição de mensalidades para tokens semânticos e contrastes de feedback; outras páginas legadas continuam pendentes de homologação.
- Executar typecheck, testes do provider/alternância e Playwright com autenticação nos portais e módulos operacionais.
- Validar com sessão real o comando, Balcão, formulários, impressões de recibos e a troca entre escolas; testes sintéticos não substituem esta homologação.
- Não apagar a branch histórica antes de validar o restante do escopo P1/P2.

## Integração paralela de Outubro
- O ensaio do Command Center deixou de repetir a PR #247 (`fix/operations-layout-composition-20261022`): está **merged em main**, logo o seu CSS responsivo já pertence à base do teste. Preservar a sua lógica em `globals.css` e validar as restantes branches em merge sintético.
- Não introduzimos resolução automática nem ignorámos novos conflitos entre branches realmente independentes.
