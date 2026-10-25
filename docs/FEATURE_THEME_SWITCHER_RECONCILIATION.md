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
RootLayout, ThemeProvider, ThemeToggle, preferência tipada e testes puros, Topbar e fundo da área principal.

## Pendências antes de release
- Converter classes fixas legadas de formulários, tabelas, modais e páginas; **dark completo ainda não está pronto**.
- Executar typecheck, testes do provider/alternância e Playwright com autenticação nos portais e módulos operacionais.
- Validar preferências ao alternar escolas, carregar, imprimir e alternar a preferência do sistema.
- Não apagar a branch histórica antes de validar o restante do escopo P1/P2.
