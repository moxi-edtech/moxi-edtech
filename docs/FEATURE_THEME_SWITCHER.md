# Feature: Alternador de Tema (Dark / Bright)

**Branch:** `feat/theme-switcher`  
**Status:** Em implementação  
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

## 2. Estado atual da base de código (Auditoria)

### O que já existe e está pronto

| Item                              | Estado | Localização                                      |
|-----------------------------------|--------|--------------------------------------------------|
| Variáveis CSS Light (`:root`)     | ✅     | `apps/web/src/app/globals.css`                   |
| Variáveis CSS Dark (`.dark`)      | ✅     | `apps/web/src/app/globals.css`                   |
| Variante Tailwind `dark`          | ✅     | `@custom-variant dark (&:is(.dark *));`          |
| Tokens semânticos (shadcn)        | ✅     | `bg-background`, `text-foreground`, etc.         |
| Configuração shadcn com CSS vars  | ✅     | `apps/web/components.json` (`cssVariables: true`)|
| Package de design tokens          | ✅     | `packages/design-tokens`                         |
| Cores de marca (green / gold)     | ✅     | Funcionam em ambos os temas                      |

### O que falta

| Item                        | Estado | Observação                                              |
|-----------------------------|--------|---------------------------------------------------------|
| Biblioteca `next-themes`    | ❌     | Não está nas dependências                               |
| `ThemeProvider`             | ❌     | Não existe no root layout                               |
| Componente de toggle        | ❌     | Não existe                                              |
| Substituição de cores fixas | ⚠️     | Muitos componentes usam `bg-slate-950`, `text-slate-100`, etc. |

---

## 3. Decisões técnicas

| Decisão                    | Escolha                          | Justificativa                                                                 |
|-----------------------------|----------------------------------|-------------------------------------------------------------------------------|
| Biblioteca                  | `next-themes`                    | Padrão de mercado para Next.js App Router; evita flash de tema (FOUC)         |
| Atributo no `<html>`        | `class`                          | Já existe o seletor `.dark` no CSS                                            |
| Tema padrão                 | `system` (com fallback light)    | Respeita a preferência do SO; fallback seguro                                 |
| Persistência                | `localStorage` (automático)      | Comportamento nativo do `next-themes`                                         |
| Transições                  | `disableTransitionOnChange`      | Evita animações estranhas durante a troca de tema                             |
| Localização do toggle       | Sidebar (footer) + Command Palette (futuro) | Fácil acesso sem poluir a interface principal                        |

---

## 4. Plano de implementação

### Fase 1 — Infraestrutura (baixo esforço)

1. Instalar dependência:
   ```bash
   pnpm -C apps/web add next-themes
   ```

2. Criar `apps/web/src/components/providers/ThemeProvider.tsx`

3. Integrar o `ThemeProvider` no `apps/web/src/app/layout.tsx`

4. Criar o componente `ThemeToggle` (ícone Sol / Lua)

5. Colocar o toggle no shell da aplicação (sidebar)

### Fase 2 — Adaptação visual (esforço médio)

Substituir cores hardcoded por tokens semânticos, priorizando:

| Prioridade | Área                    | Exemplos a substituir                          |
|------------|-------------------------|------------------------------------------------|
| P0         | Shell / Sidebar         | `bg-slate-950`, `text-slate-100`, `bg-slate-900` |
| P0         | Header / Topbar         | Cores de fundo e texto fixas                   |
| P1         | Cards e tabelas         | Bordas e fundos fixos                          |
| P1         | Formulários e inputs    | Bordas e placeholders                          |
| P2         | Componentes secundários | Badges, tooltips, modais                       |

**Mapeamento recomendado:**

| Classe antiga          | Preferir                          |
|------------------------|-----------------------------------|
| `bg-slate-950`         | `bg-sidebar` ou `bg-background`   |
| `bg-slate-900`         | `bg-sidebar-accent` / `bg-muted`  |
| `text-slate-100`       | `text-sidebar-foreground` / `text-foreground` |
| `text-slate-400`       | `text-muted-foreground`           |
| `border-slate-200`     | `border-border`                   |
| `border-slate-800`     | `border-border`                   |
| `bg-white`             | `bg-background` / `bg-card`       |
| `bg-slate-50`          | `bg-muted`                        |

As cores de marca (`klasse-green`, `klasse-gold`) **não precisam** ser alteradas — funcionam bem em ambos os temas.

### Fase 3 — Polimento

- Adicionar opção “Sistema / Claro / Escuro” no menu de preferências
- Integrar no Command Palette (`Cmd+K`)
- Atualizar `themeColor` do viewport de forma dinâmica (opcional)
- Verificar contraste (acessibilidade) nos dois temas
- Testar em páginas críticas: Dashboard, Secretaria, Financeiro, Pauta

---

## 5. Estrutura de ficheiros prevista

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← adicionar ThemeProvider
│   │   └── globals.css             ← já possui :root e .dark
│   └── components/
│       ├── providers/
│       │   └── ThemeProvider.tsx   ← novo
│       └── theme/
│           └── ThemeToggle.tsx     ← novo
└── package.json                    ← adicionar next-themes
```

---

## 6. Critérios de aceitação

- [ ] Utilizador consegue alternar entre Bright e Dark com um clique
- [ ] A preferência é mantida após refresh e entre sessões
- [ ] Não há flash de tema claro ao carregar a página em modo escuro
- [ ] Sidebar, header e conteúdo principal respeitam o tema ativo
- [ ] Cores de marca (verde e dourado) continuam legíveis e consistentes
- [ ] Funciona em desktop e mobile (Capacitor)
- [ ] Não quebra o padrão de Graciosidade (estado explícito + feedback)

---

## 7. Riscos e mitigação

| Risco                                      | Mitigação                                              |
|--------------------------------------------|--------------------------------------------------------|
| Componentes com cores hardcoded            | Auditoria progressiva por prioridade (P0 → P2)         |
| Flash de tema (FOUC)                       | Usar `next-themes` + `suppressHydrationWarning`        |
| Quebra visual em páginas legadas           | Implementar primeiro no shell e expandir gradualmente  |
| Conflito com estilos de impressão / PDF    | Manter temas apenas na UI; PDFs usam estilos próprios  |

---

## 8. Referências

- Design Tokens oficiais: `docs/design-tokens.md`
- Padrão de produto (Graciosidade): `docs/product/graciosidade.md`
- shadcn/ui + CSS Variables: documentação oficial
- next-themes: https://github.com/pacocoursey/next-themes

---

## 9. Histórico

| Data       | Autor     | Alteração                                      |
|------------|-----------|------------------------------------------------|
| 2026-10-23 | Grok      | Criação inicial da documentação na branch      |
