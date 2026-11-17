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

test("printed lists are scoped to a single academic session and paginate", () => {
  const pdf = source("lib/documentos/listaNominalPdf.ts");
  assert.match(pdf, /sessionIds\.size !== 1/);
  assert.match(pdf, /\.eq\("session_id", turma\.session_id\)/);
  assert.match(pdf, /if \(!includeAllStatus\) \{/);
  assert.match(pdf, /\.eq\("ativo", true\)/);
  assert.match(pdf, /\.in\("status", \["ativo", "ativa", "active"\]\)/);
  assert.match(pdf, /for \(let offset = 0; offset < maxRoster; offset \+= pageSize\)/);
  assert.match(pdf, /maxLimit: pageSize/);
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
  assert.match(jsonRoute, /\\.eq\\("session_id", turma\\.session_id\\)/);
  assert.match(jsonRoute, /\\.eq\\("ativo", true\\)/);
  assert.match(jsonRoute, /numero: numero\\+\\+/);
  assert.match(jsonRoute, /numero_chamada: m\\.numero_chamada/);

  const pdf = source("lib/documentos/listaNominalPdf.ts");
  assert.match(pdf, /numero: isAttendance \\|\\| month \\|\\| includeAllStatus/);
  assert.match(pdf, /: index \\+ 1/);
});

test("database migration blocks approved grade repeats across all enrolment writers", () => {
  const sql = readFileSync(
    new URL("../../../../supabase/migrations/20271117160000_guard_enrollment_prior_year_progression.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /BEFORE INSERT OR UPDATE OF escola_id, aluno_id, turma_id/);
  assert.match(sql, /NEW\\.origem_transicao_matricula_id IS NOT NULL/);
  assert.match(sql, /h\\.escola_id = NEW\\.escola_id/);
  assert.match(sql, /h\\.ano_letivo = v_target_year - 1/);
  assert.match(sql, /ENROLLMENT_PRIOR_YEAR_APPROVED_SAME_OR_LOWER_GRADE/);
  assert.match(sql, /ENROLLMENT_FINALIST_REPEAT_REQUIRES_RETAINED_DECISION/);
  assert.match(sql, /REVOKE ALL ON FUNCTION/);
});
