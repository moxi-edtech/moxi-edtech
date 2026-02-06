# KLASSE — Scheduler Engine (Fase 2)

## Objetivo
Construir o motor de horários com base relacional e UI tátil (drag & drop), garantindo conflitos detectados no banco e na UI.

---

## Estrutura Base (DB)

### Tabelas
- `horario_slots` — definição do esqueleto por dia/turno.
- `professor_disponibilidade` — hard/soft constraints de professores.
- `quadro_horarios` — quadro gerado (resultado).

### Migration
- `supabase/migrations/20260309000000_scheduler_engine.sql`

### Constraints
- Professor não duplica no mesmo slot (`EXCLUDE USING gist`).
- Sala não duplica no mesmo slot (`EXCLUDE USING gist`).
- Turma não duplica no mesmo slot (`UNIQUE`).

---

## UI/UX

### Slots (Configuração)
- Página: `/escola/[id]/horarios/slots`
- Componente: `apps/web/src/components/escola/horarios/SlotsConfig.tsx`
- UX: gerador em massa, intervalos inteligentes, abas por turno.

### Quadro (Drag & Drop)
- Página: `/escola/[id]/horarios/quadro`
- Componente: `apps/web/src/components/escola/horarios/SchedulerBoard.tsx`
- UX: estoque de aulas + grid por dia/tempo.

---

## APIs

### Slots
- `GET /api/escolas/[id]/horarios/slots`
- `POST /api/escolas/[id]/horarios/slots`

### Quadro
- `GET /api/escolas/[id]/horarios/quadro?versao_id=...&turma_id=...`
- `POST /api/escolas/[id]/horarios/quadro`

---

## Próximos Passos (Backlog)
### Backlog
- Normalizar turnos (tabela própria).
- Edge Function de auto‑geração.
- Versionamento do quadro (drafts, diff e histórico).

### Status Atual
- Conflitos server-side + feedback visual no quadro.
- Cadastro rápido de salas (inline).
- Persistência de professor_id/sala_id no save.
- Outbox offline + Server-Timing em slots/quadro.

---

## Referências
- `docs/session-implementation-notes.md`
- `agents/contracts/KLASSE_PAUTAS_MINISTERIAIS_ROADMAP_2026-02-05.md`
