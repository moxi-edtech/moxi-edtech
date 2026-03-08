# PLANO — Refatoração Mobile‑first do Lançamento de Notas (Professor)
Data: 2026-03-06
Escopo: `apps/web/src/app/professor/notas/page.tsx`, `apps/web/src/components/professor/GradeEntryGrid.tsx`

## Diagnóstico
- A pauta usa uma tabela do `@tanstack/react-table` com várias colunas.
- No mobile, a tabela exige scroll horizontal e dificulta input rápido.

## Objetivo
- Mobile-first: experiência fluida em telas pequenas sem scroll horizontal.
- Desktop: manter tabela completa como hoje.

## Plano de refatoração
1) **GradeEntryGrid responsivo** — concluído
   - Manter a tabela para `md+`.
   - Adicionar layout mobile (`sm`/`xs`) com cards por aluno:
     - Header: número + nome + status sync.
     - Inputs em grid 2x2 (MAC/NPP/NPT/MT).
     - Toggle “isento” quando aplicável.

2) **Persistir UX de auto‑save** — concluído
   - Reutilizar `updateGrade`, `updateIsento` e `scheduleSave`.
   - Garantir que o teclado virtual não quebre o scroll.

3) **Ajustar a página** — concluído
   - Toolbar fixa no mobile + botão “Salvar agora”.
   - Desktop preservado.

4) **QA visual** — pendente
   - Verificar foco/teclas nos inputs no mobile.
   - Testar com pauta grande (scroll vertical).

## Recomendação adicional (mobile-first)
- Toolbar fixa no topo com seletores de turma/disciplina/trimestre.
- Inputs maiores (altura 44px) e espaçamento de toque.
- Botão “Salvar agora” visível no mobile (além do auto‑save).
- Badge de estado offline no topo.

## Resultado esperado
- Mobile: cards empilhados com inputs grandes.
- Desktop: tabela completa preservada.
