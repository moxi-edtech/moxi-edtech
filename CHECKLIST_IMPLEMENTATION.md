# CHECKLIST_IMPLEMENTATION.md — Admin Academic Setup (Pilot Readiness)

SSOT fixo: **B = `frequencias`**. Sem evidência executada = FAIL/WARN.

---

## Fase 1 — DB / Migrations (primeiro)
- [x] P0.1 `escola_id` NOT NULL em tabelas core (evidência SQL remota)
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P0.1 no `AGENT_INSTRUCTION.md`
- [~] P0.2 Índices com `escola_id` nas tabelas grandes (WARN: `financeiro_titulos` sem índice)
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P0.2 no `AGENT_INSTRUCTION.md`
- [ ] P0.3 RLS real por role (`secretaria/professor/aluno/admin_escola`) — pendente
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL/HTTP): ver bloco P0.3 no `AGENT_INSTRUCTION.md`

- [x] P1.1 `anos_letivos` + `periodos_letivos` (TRIMESTRE 1/2/3 + `trava_notas_em`)
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P1.1 no `AGENT_INSTRUCTION.md`
- [x] P1.2 `curso_curriculos` + `curriculo_itens` (draft/published + uniques)
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P1.2 no `AGENT_INSTRUCTION.md`
- [x] P1.5 `turmas` + `turma_disciplinas` alimentada por currículo publicado
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P1.5 no `AGENT_INSTRUCTION.md`
- [~] P2.1 `frequencias` SSOT com UNIQUE/UPSERT (SQL OK, HTTP pendente)
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P2.1 no `AGENT_INSTRUCTION.md`
- [ ] P2.2 `avaliacoes` + `notas` com uniques corretos — evidência HTTP pendente
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P2.2 no `AGENT_INSTRUCTION.md`

---

## Fase 2 — Views / RPCs (leitura confiável)
- [x] P1.6 `vw_escola_setup_status` sem JOIN multiplicando
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): `select * from vw_escola_setup_status where escola_id='<ESCOLA_ID>';`
- [ ] P2.3 `vw_boletim_por_matricula` com `missing_count` / `has_missing` — falta coluna `trimestre`
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): ver bloco P2.3 no `AGENT_INSTRUCTION.md`
- [ ] Frequência resumo (view/RPC) — pendente
  - Paths: `supabase/migrations/NEW_*.sql`
  - Evidence (SQL): `select * from vw_frequencia_resumo_aluno where escola_id='<ESCOLA_ID>' limit 5;`

---

## Fase 3 — Endpoints (Admin + Professor, sem service role)
- [x] P1.1 `POST /api/escola/:id/admin/ano-letivo/upsert`
  - Path: `apps/web/src/app/api/escola/[id]/admin/ano-letivo/upsert/route.ts`
- [x] P1.1 `POST /api/escola/:id/admin/periodos-letivos/upsert-bulk`
  - Path: `apps/web/src/app/api/escola/[id]/admin/periodos-letivos/upsert-bulk/route.ts`
- [x] P1.6 `GET /api/escola/:id/admin/setup/status`
  - Path: `apps/web/src/app/api/escola/[id]/admin/setup/status/route.ts`
- [x] P1.x `GET/POST /api/escola/:id/admin/configuracoes/avaliacao-frequencia`
  - Path: `apps/web/src/app/api/escola/[id]/admin/configuracoes/avaliacao-frequencia/route.ts`

- [x] P1.3 `POST /api/escola/:id/admin/curriculo/apply-preset`
  - Path: `apps/web/src/app/api/escola/[id]/admin/curriculo/apply-preset/route.ts`
- [x] P1.4 `POST /api/escola/:id/admin/curriculo/publish`
  - Path: `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`
- [x] P1.5 `POST /api/escola/:id/admin/turmas/generate`
  - Path: `apps/web/src/app/api/escola/[id]/admin/turmas/generate/route.ts`

- [ ] P2.1 `POST /api/professor/frequencias` (SSOT) — evidência HTTP pendente
  - Path: `apps/web/src/app/api/professor/frequencias/route.ts`
- [ ] P2.2 `POST /api/professor/notas` (on-demand) — evidência HTTP pendente
  - Path: `apps/web/src/app/api/professor/notas/route.ts`

---

## Fase 4 — UI (Config Page + Wizard 1–4)
- [x] ConfiguracoesPage + status cards + banner
  - Paths: `apps/web/src/app/escola/[id]/admin/configuracoes/page.tsx`, `apps/web/src/app/escola/[id]/admin/configuracoes/ConfiguracoesClient.tsx`, `apps/web/src/components/escola/NeedsAcademicSetupBanner.tsx`
- [x] Wizard 1/4 — Ano letivo + 3 trimestres
  - Path: `apps/web/src/app/escola/[id]/admin/configuracoes/academico-completo` (novo ou ajustar)
- [x] Wizard 2/4 — Frequência (SSOT) + modelo de avaliação
  - Path: `apps/web/src/app/escola/[id]/admin/configuracoes/academico-completo` (novo ou ajustar)
- [x] Wizard 3/4 — Presets (apply + preview)
  - Paths: `apps/web/src/components/escola/settings/CurriculumBuilder.tsx` (ou novo componente dedicado)
- [x] Wizard 4/4 — Gerar turmas + turma_disciplinas
  - Path: `apps/web/src/app/escola/[id]/admin/configuracoes/academico-completo` (novo ou ajustar)

---

## Fase 5 — Evidência (SQL + HTTP)
- [~] SQL evidências P0/P1/P2 executadas (parcial)
  - P1 SQL remoto (escola_id `f406f5a7-a077-431c-b118-297224925726`, ano_letivo_id `1952fd7b-4094-487c-8ff6-9a700edfad48`)
  - P1.5 turma_id evidência: `7419a82b-6efb-4bb1-961d-a20dd20041a3`
  - Frequência SSOT
    - `select count(*) from frequencias where periodo_letivo_id is null;`
    - `select f.id from frequencias f left join periodos_letivos p on p.id=f.periodo_letivo_id where f.periodo_letivo_id is not null and p.id is null;`
    - `insert into frequencias (escola_id, matricula_id, data, status) values ('<ESCOLA_ID>', '<MATRICULA_ID>', '<DATA>', 'presente');` (esperado: falhar se fechado)
- [ ] HTTP evidências dos endpoints Admin/Professor (200/403 conforme regra)
- [ ] Report final no formato do `AGENT_INSTRUCTION.md`

---

## Scan obrigatório (P0.4)
- [ ] `rg -n "SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin|service_role" apps/web/src/app/api`
- [ ] `rg -n "createClient<Database>\\(" apps/web/src/app/api`

---

## Saída final (formato obrigatório)
- [ ] `PILOT READINESS: GO/NO-GO`
- [ ] `BLOCKERS` listados
- [ ] `WARNINGS` listados
