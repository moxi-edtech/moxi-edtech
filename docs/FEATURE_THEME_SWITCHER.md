# Feature: Alternador de Tema (Dark / Bright)

**Branch:** `feat/theme-switcher`  
**Status:** Em implementação (Fase 2 — secretaria em curso)  
**Data:** 2026-10-23  
**Idioma da documentação:** Português

---

## 1. Objetivo

Permitir que o utilizador alterne entre dois temas visuais oficiais da KLASSE:

| Tema   | Nome interno | Descrição                                      |
|--------|--------------|------------------------------------------------|
| Bright | `light`      | Tema claro (padrão atual da aplicação)         |
| Dark   | `dark`       | Tema escuro, confortável para uso prolongado   |

O utilizador deve poder:
- Alternar o tema em qualquer momento
- Manter a preferência entre sessões (persistência local)
- Respeitar a preferência do sistema operativo (opcional)

---

## 2. Progresso da implementação

### Fase 1 — Infraestrutura ✅

| Item | Estado | Notas |
|------|--------|-------|
| Dependência `next-themes` | ✅ | `apps/web/package.json` (`^0.4.6`) |
| `ThemeProvider` | ✅ | `apps/web/src/components/providers/ThemeProvider.tsx` |
| Integração no root layout | ✅ | `attribute="class"`, `defaultTheme="system"`, `enableSystem` |
| `ThemeToggle` | ✅ | Lucide Sol/Lua, sem FOUC, tokens semânticos |
| Toggle no shell | ✅ | Topbar (lado direito) |
| Remoção ModuleSwitcher | ✅ | Removido do Topbar, PortalLayout e ficheiro apagado |

### Fase 2 — Adaptação visual

| Prioridade | Área | Estado |
|------------|------|--------|
| P0 | Shell / Sidebar | ✅ `Sidebar.tsx` com tokens `sidebar-*` |
| P0 | Header / Topbar | ✅ `Topbar.tsx` + `AppShell.tsx` |
| P1 | UI base (Input, Select, Modal, Drawer, Button, Table…) | ✅ |
| P1 | Dashboard (KpiCard, TaskList, DashboardHeader…) | ✅ |
| P1 | Secretaria — listas e modais prioritários | ✅ ver §2.1 |
| P1 | Relatórios financeiros (TabFluxo, TabPropinas, TabCaptacao) | ✅ |
| P2 | Wizards grandes (Balcão, Admissão) | 🔄 preparados localmente (~120–146 KB) |
| P2 | Restantes páginas secretaria | ⏳ Pendente |

### 2.1 Secretaria — componentes migrados

| Componente | Estado |
|------------|--------|
| `AlunosListClient.tsx` | ✅ |
| `ProfessoresListClient.tsx` | ✅ |
| `PagamentoModal.tsx` | ✅ |
| `AlunoProfilePanel.tsx` | ✅ |
| `BalcaoServicoModal.tsx` | ✅ |
| `ClassesListClient.tsx` | ✅ |
| `ImportacoesListClient.tsx` | ✅ |
| `MinhaProdutividade.tsx` | ✅ |
| `relatorio-financeiro/TabFluxo.tsx` | ✅ |
| `relatorio-financeiro/TabPropinas.tsx` | ✅ |
| `relatorio-financeiro/TabCaptacao.tsx` | ✅ |
| `BalcaoAtendimento.tsx` | 🔄 transform local pronta (ficheiro grande) |
| `AdmissaoWizardClient.tsx` | 🔄 transform local pronta (ficheiro grande) |

### O que ainda falta (global)

| Item | Estado | Observação |
|------|--------|------------|
| Wizards grandes secretaria | 🔄 | Balcão / Admissão — push de ficheiros >100 KB |
| Restantes listas/modais secretaria | ⏳ | MatriculasList, TurmasList, etc. |
| Testes unitários / E2E de tema | ❌ | Definidos na §7 |
| Opção Sistema/Claro/Escuro no menu | ❌ | Fase 3 |
| Integração no Command Palette | ❌ | Fase 3 |

---

## 3. Decisões técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Biblioteca | `next-themes` | Padrão de mercado para Next.js App Router; evita FOUC |
| Atributo no `<html>` | `class` | Já existe o seletor `.dark` no CSS |
| Tema padrão | `system` (fallback light) | Respeita a preferência do SO |
| Persistência | `localStorage` (automático) | Comportamento nativo do `next-themes` |
| Transições | `disableTransitionOnChange` | Evita animações estranhas na troca |
| Localização do toggle | Topbar (direita) | Sempre visível no shell principal |
| Cores de marca | Mantidas (`#1F6B3B`, `#E3B23C`) | Funcionam bem em ambos os temas |
| Tokens prioritários | `bg-card`, `bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground` | Substituição progressiva de `slate-*` / `bg-white` |

---

## 4. Plano de implementação

### Fase 1 — Infraestrutura ✅ (concluída)

1. ✅ Instalar `next-themes`
2. ✅ Criar `ThemeProvider`
3. ✅ Integrar no `layout.tsx`
4. ✅ Reescrever `ThemeToggle`
5. ✅ Colocar toggle no Topbar

### Fase 2 — Adaptação visual (em curso)

Substituir cores hardcoded por tokens semânticos.

**Mapeamento recomendado:**

| Classe antiga | Preferir |
|---------------|----------|
| `bg-slate-950` / `bg-slate-900` | `bg-background` / `bg-sidebar` |
| `bg-white` | `bg-card` / `bg-background` |
| `bg-slate-50` / `bg-slate-100` | `bg-muted` |
| `text-slate-900` / `text-slate-700` | `text-foreground` |
| `text-slate-500` / `text-slate-400` | `text-muted-foreground` |
| `border-slate-200` / `border-slate-100` | `border-border` |
| `divide-slate-*` | `divide-border` |
| Badges de status | cores com opacidade (`emerald-500/10`) + `dark:` |

### Fase 3 — Polimento

- Opção “Sistema / Claro / Escuro” no menu de preferências
- Integrar no Command Palette (`Cmd+K`)
- Atualizar `themeColor` do viewport de forma dinâmica (opcional)
- Verificar contraste (acessibilidade) nos dois temas
- Testar páginas críticas: Dashboard, Secretaria, Financeiro, Pauta

---

## 5. Estrutura de ficheiros

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← ThemeProvider integrado
│   │   └── globals.css             ← :root e .dark
│   └── components/
│       ├── providers/
│       │   └── ThemeProvider.tsx   ← criado
│       ├── ThemeToggle.tsx         ← reescrito
│       ├── layout/klasse/
│       │   ├── AppShell.tsx        ← tokens semânticos
│       │   ├── Sidebar.tsx         ← tokens semânticos
│       │   └── Topbar.tsx          ← tokens + ThemeToggle
│       └── secretaria/
│           ├── AlunosListClient.tsx      ← ✅ theme-aware
│           ├── ProfessoresListClient.tsx ← ✅ theme-aware
│           ├── PagamentoModal.tsx        ← ✅ theme-aware
│           ├── AlunoProfilePanel.tsx     ← ✅ theme-aware
│           └── …
├── tests/
│   ├── unit/
│   │   └── theme-toggle.spec.ts    ← planeado
│   └── theme-switcher.e2e.ts       ← planeado
└── package.json                    ← next-themes
```

---

## 6. Critérios de aceitação

- [x] Utilizador consegue alternar entre Bright e Dark com um clique
- [x] A preferência é mantida após refresh e entre sessões (via next-themes)
- [x] Não há flash de tema claro ao carregar a página em modo escuro (`suppressHydrationWarning` + mounted guard)
- [x] Sidebar, header e conteúdo principal do shell respeitam o tema ativo
- [x] Listas prioritárias da secretaria (alunos, professores) respeitam o tema
- [ ] Páginas de conteúdo restantes (cards, tabelas, forms) respeitam o tema
- [x] Cores de marca (verde e dourado) continuam legíveis
- [ ] Funciona em desktop e mobile (Capacitor) — validação manual pendente
- [ ] Não quebra o padrão de Graciosidade
- [ ] Testes unitários e E2E passam

---

## 7. Testes

### Estado atual da infraestrutura de testes

| Tipo | Situação |
|------|----------|
| Unitários | Existem em `apps/web/tests/unit/` (poucos) |
| E2E (Playwright) | Configurado (`playwright.config.ts`) |
| Script `test` | Placeholder |
| Testes de tema | **Não existem** (definidos abaixo) |

### Testes a implementar

#### 7.1 Unitário — `ThemeToggle`

**Ficheiro:** `apps/web/tests/unit/theme-toggle.spec.ts`

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Renderiza o botão de toggle | Botão visível com `aria-label` adequado |
| 2 | Clique alterna de `light` → `dark` | `setTheme("dark")` é chamado |
| 3 | Clique alterna de `dark` → `light` | `setTheme("light")` é chamado |
| 4 | Estado pré-mount | Placeholder desabilitado (evita hydration mismatch) |

#### 7.2 E2E — Playwright

**Ficheiro:** `apps/web/tests/theme-switcher.e2e.ts`

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Carga com tema claro | `<html>` sem classe `dark` |
| 2 | Toggle ativa dark | `<html>` com classe `dark` |
| 3 | Toggle volta a light | Classe `dark` removida |
| 4 | Persistência após refresh | Tema mantido |
| 5 | Persistência em navegação | Tema mantido entre rotas |
| 6 | Sem FOUC | Classe `dark` desde o primeiro paint quando guardado |

#### 7.3 Checklist manual

- [x] Shell (sidebar + header)
- [ ] Dashboard principal
- [x] Secretaria — lista de alunos / professores
- [ ] Secretaria — wizards (Balcão, Admissão)
- [ ] Financeiro — dashboard e lançamentos
- [ ] Pauta do professor
- [ ] Wizard de importação
- [ ] Login / ativação de acesso

#### 7.4 Comandos sugeridos

```bash
pnpm -C apps/web test:unit:theme
pnpm -C apps/web exec playwright test tests/theme-switcher.e2e.ts
```

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Componentes com cores hardcoded | Auditoria progressiva P0 → P2 |
| Flash de tema (FOUC) | `next-themes` + `suppressHydrationWarning` + mounted guard |
| Quebra visual em páginas legadas | Shell primeiro; expandir gradualmente |
| Ficheiros muito grandes (>100 KB) | Transform local + push dedicado |
| Conflito com impressão / PDF | Temas só na UI |
| Testes frágeis | Preferir `getByRole` + `aria-label` |

---

## 9. Referências

- Design Tokens: `docs/design-tokens.md`
- Graciosidade: `docs/product/graciosidade.md`
- next-themes: https://github.com/pacocoursey/next-themes
- Playwright: https://playwright.dev

---

## 10. Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-10-23 | Grok | Criação inicial da documentação |
| 2026-10-23 | Grok | Secção completa de testes |
| 2026-10-23 | Grok | Fase 1 concluída; Fase 2 P0 (shell) concluída |
| 2026-10-23 | Grok | Secretaria prioritária migrada (Alunos, Professores, Pagamento, Profile, Tabs) |
