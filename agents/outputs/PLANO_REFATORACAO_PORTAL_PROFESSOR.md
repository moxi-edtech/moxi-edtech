# PLANO — Refatoração do Portal do Professor (Mobile‑first + Desktop)
Data: 2026-03-06
Escopo: `apps/web/src/app/professor`, `apps/web/src/components/layout/klasse/*`, `apps/web/src/components/professor/*`

## Diagnóstico
- O portal do professor usa `apps/web/src/app/professor/layout.tsx` → `AppShell` (sidebar + topbar).
- `AppShell` é desktop-first: sidebar persistente e topbar fixa.
- O portal do aluno já tem uma navegação mobile-first (bottom nav) em `AlunoLayoutClient`.

## Objetivo
- Manter sidebar no desktop (telas grandes).
- Adicionar bottom navigation no mobile, semelhante ao portal do aluno.
- Evitar duplicação de lógica de navegação e assegurar consistência de rotas.

## Plano de Refatoração
1) **Extrair nav config do professor** — concluído
   - `lib/professorNav.ts` criado com itens (`href`, `label`, `icon`).
   - Itens reutilizados no bottom nav.

2) **Criar layout híbrido do professor** — concluído
   - `ProfessorPortalLayout` com sidebar no desktop e bottom nav no mobile.
   - `AppShell` suporta `mobileNav` + `hideSidebarOnMobile`.

3) **Implementar `ProfessorBottomNav`** — concluído
   - Navegação fixa no rodapé para mobile com rota ativa.

4) **Refatorar `professor/layout.tsx`** — concluído
   - `professor/layout.tsx` usa `ProfessorPortalLayout`.

5) **Garantir consistência visual** — em progresso
   - Notas ajustadas para mobile.
   - Restam turmas/frequências para revisão.

6) **Regressão / QA** — pendente
   - Validar rota ativa na bottom nav.
   - Confirmar atalhos do sidebar.
   - Testar responsividade.

## Observações
- Não altera regras de acesso ou RLS.
- Pode ser feito incrementalmente: layout híbrido primeiro, ajustes de pages depois.
