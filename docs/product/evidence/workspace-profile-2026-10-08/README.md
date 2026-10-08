# Composição Perfil / Workspace — ensaio visual isolado

Capturas do `CommandCenterShell` real com `DossierTabs workspace` real e dados inteiramente fictícios, sem autenticação e sem RPC ao Supabase. A secção de conteúdo usa cartões fictícios, **não representa os campos reais do dossier**.

- `profile-shell-1366x768-equivalent-150.png`: viewport CSS 911×512 equivalente à largura/altura útil a 150%; `document.documentElement.scrollWidth === clientWidth === 911`.
- `profile-shell-1440x900-equivalent-100.png`: viewport 1440×900, composição de desktop.
- Hierarquia observada: cabeçalho de aluno único, navegação do Command Center, subtítulo de Perfil integral e tabs secundárias Dados pessoais, Financeiro, Histórico, Histórico Transitado e Documentos.

**Limite de aceite:** viewport equivalente não equivale ao zoom nativo. Sem sidebar/topbar reais, autenticação, papeis/polo ou dados autorizados; esses gates ainda exigem teste de integração.
