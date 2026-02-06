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

## Pauta Reativa (Professor + Secretaria)
- Grade Excel‑like com cálculo instantâneo: `apps/web/src/components/professor/GradeEntryGrid.tsx`.
- Professor: `apps/web/src/app/professor/notas/page.tsx` (autosave batch + trimestre).
- Secretaria: `apps/web/src/app/secretaria/(portal-secretaria)/notas/page.tsx`.
- API professor detalhada: `GET /api/professor/pauta?detalhado=1&trimestre=...`.
- API secretaria grid: `GET /api/secretaria/turmas/:id/pauta-grid?disciplinaId=...&trimestre=...`.
- API secretaria save: `POST /api/secretaria/notas`.
- PDF oficial:
  - Mini‑Pauta: `apps/web/src/templates/pdf/ministerio/MiniPautaV2.tsx`.
  - Pauta Trimestral: `apps/web/src/templates/pdf/ministerio/PautaTrimestralV1.tsx`.
  - Pauta Rápida exporta PDF: `apps/web/src/components/secretaria/PautaRapidaModal.tsx`.

## Backlog imediato
- Menu/Sidebar: adicionar link para `/secretaria/notas` no portal secretaria.
- Metadata oficial (província, diretor, professor) no PDF via endpoint único.
- Fecho de período: bloquear edição na grade quando período fechado.
- Assiduidade/Comportamento: integrar colunas adicionais no grid (MAC/NPP/NPT + assiduidade).
- QR Code real no PDF via URL de validação pública.

## Fase 2 — Motor de Horários (Scheduler)
- Migration base: `supabase/migrations/20260309000000_scheduler_engine.sql`.
- Configuração de slots (UX): `apps/web/src/components/escola/horarios/SlotsConfig.tsx`.
- Página de slots: `/escola/[id]/horarios/slots`.
- Scheduler Board (DnD): `apps/web/src/components/escola/horarios/SchedulerBoard.tsx`.
- Página do quadro: `/escola/[id]/horarios/quadro`.
- API slots: `GET|POST /api/escolas/[id]/horarios/slots`.
- API quadro: `GET|POST /api/escolas/[id]/horarios/quadro`.

## Backlog Fase 2 (próximos passos)
- Mapeamento de turnos reais (persistir `turno_id` em tabela própria).
- Edge Function de auto-geração (IA/heurística).
- Versionamento de quadros (drafts + histórico).

## Atualizações — Scheduler (Performance/UX)
- Validação server-side de conflitos com retorno `409`.
- Feedback visual de conflito no quadro.
- Cadastro rápido de salas no quadro.
- Persistência de `professor_id` e `sala_id` no save.
- Outbox offline em slots/quadro + Server-Timing.

## Pauta Reativa (Professor + Secretaria)
- Grade Excel‑like com cálculo instantâneo: `apps/web/src/components/professor/GradeEntryGrid.tsx`.
- Professor: `apps/web/src/app/professor/notas/page.tsx` (autosave batch + trimestre).
- Secretaria: `apps/web/src/app/secretaria/(portal-secretaria)/notas/page.tsx`.
- API professor detalhada: `GET /api/professor/pauta?detalhado=1&trimestre=...`.
- API secretaria grid: `GET /api/secretaria/turmas/:id/pauta-grid?disciplinaId=...&trimestre=...`.
- API secretaria save: `POST /api/secretaria/notas`.
- PDF oficial:
  - Mini‑Pauta: `apps/web/src/templates/pdf/ministerio/MiniPautaV2.tsx`.
  - Pauta Trimestral: `apps/web/src/templates/pdf/ministerio/PautaTrimestralV1.tsx`.
  - Pauta Rápida exporta PDF: `apps/web/src/components/secretaria/PautaRapidaModal.tsx`.

## Backlog imediato
- Menu/Sidebar: adicionar link para `/secretaria/notas` no portal secretaria.
- Metadata oficial (província, diretor, professor) no PDF via endpoint único.
- Fecho de período: bloquear edição na grade quando período fechado.
- Assiduidade/Comportamento: integrar colunas adicionais no grid (MAC/NPP/NPT + assiduidade).
- QR Code real no PDF via URL de validação pública.

## Migrations principais
- `20261103000000_vw_boletim_consolidado.sql`
- `20261103000001_fix_financeiro_trigger.sql`
- `20261104000000_global_search_entities.sql`
- `20261104000001_global_search_financeiro.sql`
- `20261104000002_global_search_admin.sql`
