# Implementações Recentes — Nov/2026

## Visão geral
Este documento resume as entregas recentes nas áreas de pauta (professor), command palette, rematrícula em massa e global search multi‑portal.

## Pauta “Excel-like” (Professor)
- UI em grade com navegação por setas/Enter.
- Autosave no `onBlur` com indicador ✅.
- Validação instantânea (0–20) com feedback visual e som de erro.
- Endpoint de pauta para alimentar o grid: `GET /api/professor/pauta`.

## Command Palette (Action-first)
- Campo único com busca global e sugestões de ações.
- Intentions: “Pagamento João” → ação direta para pagamentos; “Nota Maria” → abre pauta com destaque.
- Integração no Topbar para todos os portais.

## Rematrícula em Massa (Promoção)
- Filtro por nome/status, pré‑visualização e seleção em lote.
- “Promover todos” via RPC, com opção de gerar mensalidades.
- Feedback de inseridos/ignorados.

## Global Search (Secretaria, Financeiro, Admin)
- RPC unificada `search_global_entities` com cursor e limite determinístico.
- Views por entidade: `vw_search_*` (alunos, turmas, matrículas, documentos, mensalidades, pagamentos, recibos, professores, cursos, classes, usuários).
- Client: `useGlobalSearch` suporta `portal`/`types` e mapeia `type → href`.

## Central de documentos (Turma)
- Pauta em Branco: `GET /api/secretaria/turmas/:id/pauta-branca`.
- Mini‑Pautas por disciplina: `GET /api/secretaria/turmas/:id/mini-pautas`.

## Migrations principais
- `20261103000000_vw_boletim_consolidado.sql`
- `20261103000001_fix_financeiro_trigger.sql`
- `20261104000000_global_search_entities.sql`
- `20261104000001_global_search_financeiro.sql`
- `20261104000002_global_search_admin.sql`
