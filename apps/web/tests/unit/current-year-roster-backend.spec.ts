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
