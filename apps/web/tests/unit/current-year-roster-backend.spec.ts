import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("secretaria turma roster requires matching school, session and active enrolment", () => {
  const route = source("app/api/secretaria/turmas/[id]/alunos/route.ts");
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("session_id", turma\.session_id\)/);
  assert.match(route, /\.eq\("ativo", true\)/);
  assert.match(route, /\.in\("status", ACTIVE_MATRICULA_STATUSES\)/);
  assert.match(route, /TURMA_SEM_ANO_LETIVO/);
  assert.match(route, /authorizeTurmasManage/);
});

test("turma details do not count old, concluded or transferred enrolments as current", () => {
  const route = source("app/api/secretaria/turmas/[id]/detalhes/route.ts");
  const query = route.slice(route.indexOf("let alunosQuery"), route.indexOf("const { data: alunosData"));
  assert.match(query, /\.eq\('session_id', turmaResult\.session_id\)/);
  assert.match(query, /\.eq\('ativo', true\)/);
  assert.match(query, /\.in\('status', ACTIVE_MATRICULA_STATUSES\)/);
  assert.doesNotMatch(query, /concluid[oa]|transferid[oa]/);
});

test("PDF, XLSX e lotes lêem matrícula na mesma sessão e sem truncagem silenciosa", () => {
  const pdf = source("lib/documentos/listaNominalPdf.ts");
  const service = source("lib/documentos/listaNominalService.ts");
  assert.match(pdf, /loadNominalRoster/);
  assert.doesNotMatch(pdf, /\.from\("matriculas"\)/);
  assert.match(service, /sessionIds\.size !== 1/);
  assert.match(service, /\.eq\("session_id", sessionId\)/);
  assert.match(service, /selectMatriculasDaLista/);
  assert.match(service, /for \(let offset = 0; offset <= maxRoster; offset \+= pageSize\)/);
  assert.match(service, /maxLimit: pageSize/);
  assert.doesNotMatch(service, /\.eq\("ativo", true\)/);
});

test("enrolment counts are independent of the page of rows returned", () => {
  const route = source("app/api/escolas/[id]/matriculas/route.ts");
  assert.match(route, /count: "exact", head: true/);
  assert.match(route, /const \[totalCount, pendingCount\] = await Promise\.all/);
  assert.match(route, /totalCount\.count \?\? 0/);
  assert.match(route, /pendingCount\.count \?\? 0/);
  assert.doesNotMatch(route, /const total = rows\.length/);
});

test("nominal list JSON and PDF exclude closed enrolments and use contiguous visible numbers", () => {
  const jsonRoute = source("app/api/secretaria/turmas/[id]/alunos/lista/route.ts");
  assert.match(jsonRoute, /\.eq\("session_id", turma\.session_id\)/);
  assert.match(jsonRoute, /\.eq\("ativo", true\)/);
  assert.match(jsonRoute, /numero: numero\+\+/);
  assert.match(jsonRoute, /numero_chamada: m\.numero_chamada/);

  const pdf = source("lib/documentos/listaNominalPdf.ts");
  assert.match(pdf, /numero: isAttendance \|\| month \|\| includeAllStatus/);
  assert.match(pdf, /: index \+ 1/);
});

test("destination activation relies only on the canonical RAA decision", () => {
  const sql = readFileSync(
    new URL("../../../../supabase/migrations/20271117160000_guard_enrollment_prior_year_progression.sql", import.meta.url),
    "utf8"
  );

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.guard_enrollment_raa_progression_v1/);
  assert.match(sql, /public\.resolve_raa_progression_for_matricula\(/);
  assert.match(sql, /v_decision='transitou'/);
  assert.match(sql, /v_decision='retido'/);
  assert.match(sql, /v_decision='concluiu'/);
  assert.match(sql, /v_decision='inscricao_condicional'/);
  assert.match(sql, /ENROLLMENT_RAA_DECISION_REQUIRED/);
  assert.match(sql, /ENROLLMENT_RAA_DESTINATION_MISMATCH/);
  assert.match(sql, /canonicalize_matricula_status_text\(NEW\.status\) <> 'ativo'/);
  assert.match(sql, /NEW\.escola_id/);
  assert.match(sql, /NEW\.aluno_id/);
  assert.match(sql, /v_destination\.ano_letivo - 1/);
  assert.doesNotMatch(sql, /SELECT\s+lower\(btrim\(h\.resultado_final\)\)/i);
  assert.doesNotMatch(sql, /from\s+public\.historico_anos\s+h/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
});

test("audited administrative class corrections bypass RAA only with an exact nonce", () => {
  const sql = readFileSync(
    new URL("../../../../supabase/migrations/20271117160000_guard_enrollment_prior_year_progression.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /public\.balcao_pauta_turma_correction_nonce/);
  assert.match(sql, /nonce\.actor_id = auth\.uid\(\)/);
  assert.match(sql, /nonce\.matricula_id = NEW\.id/);
  assert.match(sql, /nonce\.turma_origem_id = OLD\.turma_id/);
  assert.match(sql, /nonce\.turma_destino_id = NEW\.turma_id/);
  assert.match(sql, /NEW\.ano_letivo IS NOT DISTINCT FROM OLD\.ano_letivo/);
});

test("same-class turma transfers keep their existing audited transfer guards", () => {
  const sql = readFileSync(
    new URL("../../../../supabase/migrations/20271117160000_guard_enrollment_prior_year_progression.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /previous\.classe_id=next\.classe_id/);
  assert.match(sql, /previous\.curso_id=next\.curso_id/);
  assert.match(sql, /previous\.session_id=next\.session_id/);
  assert.match(sql, /NEW\.turma_id IS DISTINCT FROM OLD\.turma_id/);
});
