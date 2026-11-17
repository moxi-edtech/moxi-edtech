import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const web = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20271129012000_pauta_trimestral_conclusao_notificacao.sql"),
  "utf8",
);

test("Saving professor grades never directly dispatches student notifications", () => {
  const api = web("app/api/professor/notas/route.ts");
  assert.match(api, /lancar_notas_batch/);
  assert.doesNotMatch(api, /dispatchAlunoNotificacao/);
  assert.doesNotMatch(api, /NOTA_BAIXA/);
  assert.doesNotMatch(api, /NOTA_LANCADA/);
});

test("Completion is explicit and independent of partial writes", () => {
  const page = web("app/professor/notas/page.tsx");
  const api = web("app/api/professor/notas/concluir/route.ts");
  assert.match(page, /Concluir lançamento/);
  assert.match(page, /hasUnsavedGrades/);
  assert.match(page, /!online/);
  assert.match(page, /handleCompleteGrades/);
  assert.match(api, /resolveProfessorAcademicContext/);
  assert.match(api, /assertAcademicYearEntity/);
  assert.match(api, /concluir_pauta_trimestral/);
});

test("Database completion checks model, roster and persisted notes and is idempotent", () => {
  assert.match(migration, /UNIQUE \(escola_id, turma_disciplina_id, periodo_letivo_id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.pauta_conclusoes FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /SECURITY DEFINER SET search_path = ''/);
  assert.match(migration, /public\.turma_disciplinas_professores/);
  assert.match(migration, /public\.modelos_avaliacao/);
  assert.match(migration, /m\.session_id = v_ano_id AND m\.ativo IS TRUE/);
  assert.match(migration, /CROSS JOIN unnest\(v_required\)/);
  assert.match(migration, /AND n\.valor IS NOT NULL/); // zero must be valid
  assert.match(migration, /IF v_missing > 0 THEN/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /ON CONFLICT \(escola_id,turma_disciplina_id,periodo_letivo_id\) DO NOTHING/);
});

test("Notifications are emitted once by the DB and scoped to authorized school staff", () => {
  assert.match(migration, /AFTER INSERT ON public\.pauta_conclusoes/);
  assert.match(migration, /'workflow','pauta_concluida'/);
  assert.match(migration, /ev\.payload->>'workflow' = 'pauta_concluida'/);
  assert.match(migration, /FROM public\.escola_users eu/);
  assert.match(migration, /eu\.escola_id = ev\.escola_id/);
  assert.match(migration, /public\.inserir_notificacao/);
});


test("Save now sends draft grades and completion status is read through RLS", () => {
  const page = web("app/professor/notas/page.tsx");
  const api = web("app/api/professor/notas/concluir/route.ts");
  assert.match(page, /handleSaveBatch\(gradeDraft\.length > 0 \? gradeDraft : pauta\)/);
  assert.match(page, /Boolean\(row\.is_isento\) !== Boolean\(saved\.is_isento\)/);
  assert.match(page, /api\/professor\/notas\/concluir\?\$\{params\.toString\(\)\}/);
  assert.match(api, /export async function GET/);
  assert.match(migration, /CREATE POLICY pauta_conclusoes_professor_select/);
  assert.match(migration, /td\.professor_id = pr\.id/);
});

test("Only committed completion events can notify staff; legacy grade events cannot", () => {
  assert.match(migration, /IS DISTINCT FROM 'pauta_concluida' THEN/);
  assert.match(migration, /Unverified legacy nota events must not generate staff notifications/);
  assert.doesNotMatch(migration, /Preserve legacy callers of notas\.lancadas/);
});

test("Staff notification links to the real grade page and its academic context", () => {
  const secretariaPage = web("app/secretaria/(portal-secretaria)/notas/page.tsx");
  assert.match(migration, /\/secretaria\/notas\?turmaId=/);
  assert.match(migration, /'disciplina_id',v_disciplina_id/);
  assert.match(migration, /'&trimestre='/);
  assert.match(secretariaPage, /requestedTrimestre/);
  assert.match(secretariaPage, /periodo\.numero === requestedTrimestre/);
});
