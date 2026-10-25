# Reconciliação do Theme Switcher — 2026-10-25

Origem: `feat/theme-switcher`. Reconciliada a partir da `main` (`2f51880ce93e5ec78562f66d8a7ff33755caf194`) numa nova branch, sem forçar rebase da origem.

## Decisões
- Preservar o `ModuleSwitcherInner`, pesquisa e fluxos do Balcão; a branch de origem removia o ModuleSwitcher.
- Aproveitar os tokens `:root` / `.dark` / `@custom-variant dark` já existentes no CSS.
- Oferecer light, dark e system; persistir por navegador em `klasse-theme`, com leitura retrocompatível de `theme`.
- Provider local, sem `next-themes`: a branch antiga acrescentou a dependência mas não atualizou `pnpm-lock.yaml`, incompatível com installs congeladas.
- Bootstrap antes do paint, com `suppressHydrationWarning` já no RootLayout.
- Alternador em Topbar desktop e no menu no mobile; sem alterações de autenticação, permissões, RPC ou pagamentos.
- A vista de impressão continua com fundo branco explícito.

## Escopo já integrado
- Fundamentos: RootLayout, ThemeProvider, ThemeToggle, bootstrap pré-paint, preferência tipada, testes unitários e workflow `Theme Switcher Guard`.
- Shell: Topbar, fundo principal de AppShell; `ModuleSwitcherInner` preservado. A sidebar mantém o padrão escuro institucional nos dois temas.
- Partilhados: Card, KpiCard, SecondaryAction, TaskList, DashboardHeader, Button, Drawer, ModalShell, StatusPill, Alert, Sheet e notificações.
- Secretaria: AlunosList, ProfessoresList, ClassesList, ImportacoesList, MatriculasList, AlunoProfilePanel, PagamentoModal, BalcaoServicoModal, FilaAtendimentoModal, MinhaProdutividade e FechoCaixaCego.
- Relatórios: TabFluxo, TabPropinas, TabCaptacao (apenas classes visuais; lógica e consultas intactas).
- Portal do aluno: BottomNav.
- Sem migrations, mudanças de auth, alterações financeiras ou refactors funcionais antigos.

## Exclusões intencionais
- `ModuleSwitcher` NÃO é removido: a branch antiga eliminava uma funcionalidade que continua em uso.
- `PagamentoDividaModal` e fluxos de impressão/recibo: aguardar teste visual/print antes de retematizar.
- Wizards grandes do Balcão/Admissão e restantes portais: dívida de cobertura visual; evitar sobrescrever melhorias recentes com snapshots antigos.
- Nenhuma dependência `next-themes` ou modificação do lockfile; o provider local é autocontido.

## Validação
- `Theme Switcher Guard`: teste de parsing e resolução de preferência light/dark/system.
- `KF2 Search Audit`: garantir nenhum hexadecimal de marca introduzido em novas linhas operacionais.
- Gates de CI gerais e homologação autenticada continuam obrigatórios antes de tirar a PR do modo draft.


## Pendências antes de release
- Converter classes fixas legadas de formulários, tabelas, modais e páginas; **dark completo ainda não está pronto**.
- Executar typecheck, testes do provider/alternância e Playwright com autenticação nos portais e módulos operacionais.
- Validar preferências ao alternar escolas, carregar, imprimir e alternar a preferência do sistema.
- Não apagar a branch histórica antes de validar o restante do escopo P1/P2.
