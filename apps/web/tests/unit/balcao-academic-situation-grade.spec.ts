import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("academic situation uses the existing reenrollment route, preserving student context", () => {
  const registry = source("lib/balcao/action-registry.ts");
  assert.match(registry, /reenrollment: \{/);
  assert.match(registry, /label: "Situação académica"/);
  assert.match(registry, /balcaoView: "reenrollment"/);
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /id: "reenrollment",\s*title: "Situação académica"/);
  assert.match(workspace, /aria-label="Aluno selecionado para situação académica"/);
});

test("individual grade action is not dependent on RAA pending cases and respects permission", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /view === "reenrollment" && rematriculaCanWriteGrades/);
  assert.match(workspace, /rematriculaAcademic\?\.source\?\.turma_id/);
  assert.match(workspace, /rematriculaAcademic\?\.source\?\.ano_letivo_id/);
  assert.match(workspace, /onClick=\{\(\) => onLancarNota\(null\)\}/);
  assert.match(workspace, /if \(!rematricula.canWriteGrades\) return/);
});

test("grade modal selects official assessment type and submits exactly one student", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /tipoAvaliacao.*"MAC".*"NPP".*"NPT"/);
  for (const kind of ["MAC", "NPP", "NPT"]) assert.match(modal, new RegExp('<option value="' + kind + '">'));
  assert.match(modal, /tipo_avaliacao: tipoAvaliacao/);
  assert.match(modal, /notas: \[\{ aluno_id: alunoId, valor \}\]/);
  assert.match(modal, /originAnoLetivoId/);
  assert.match(modal, /\/api\/secretaria\/notas\/periodos/);
  assert.match(modal, /\/pauta-grid\?/);
});

test("canonical grade API enforces tenant, role, official calendar and enrollment", () => {
  const route = source("app/api/secretaria/notas/route.ts");
  assert.match(route, /authorizeTurmasManage/);
  assert.match(route, /resolveAcademicYearContext/);
  assert.match(route, /GRADE_PERIOD_UNRESOLVED/);
  assert.match(route, /GRADE_DISCIPLINE_INACTIVE_TRIMESTER/);
  assert.match(route, /ACTIVE_ENROLLMENT_REQUIRED/);
  assert.match(route, /lancar_notas_batch/);
  assert.match(route, /idempotency-key/);
});
 
test("academic situation prioritizes the current state and next action before trimester progress", () => {
  const header = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  assert.match(header, /Situação académica<\/h2>/);
  assert.match(header, /aria-label="Resumo da situação académica"/);
  assert.ok(
    header.indexOf('aria-label="Elegibilidade académica"') <
      header.indexOf('aria-label="Percurso académico do ano em curso"'),
    "next action must precede the detailed trimester timeline",
  );
});

test("a student without an associated enrollment gets an explicit non-writing state", () => {
  const workspace = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(workspace, /!dossier\.aluno\.matricula_id \? "SOURCE_RECORD_REQUIRED"/);
  assert.match(workspace, /rematriculaState === "SOURCE_RECORD_REQUIRED"/);
  assert.match(workspace, /Matrícula de origem por confirmar/);
  assert.match(workspace, /Verificar matrícula novamente/);
  assert.match(workspace, /rematriculaAcademic\?\.source\?\.matricula_id &&/);
  const api = source("app/api/secretaria/notas/route.ts");
  assert.match(api, /ACTIVE_ENROLLMENT_REQUIRED/);
});

test("grade receipt confirms exactly what was saved and requires deliberate next action", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /setGradeReceipt\(\{/);
  assert.match(modal, /disciplina: selected\.disciplina\.nome/);
  assert.match(modal, /onAcademicSaved\?\.\(\)/);
  assert.match(modal, /role="status" aria-live="polite"/);
  assert.match(modal, /Nota registada/);
  assert.match(modal, /Lançar outra avaliação/);
  assert.match(modal, /disabled=\{loading \|\| periodUnavailable \|\| Boolean\(gradeReceipt\)\}/);
});

test("locked periods are explained, and official write permissions remain server controlled", () => {
  const modal = source("components/secretaria/EnrollmentPostActionModal.tsx");
  assert.match(modal, /selectedPeriod\?\.estado === "past"/);
  assert.match(modal, /selectedPeriod\?\.estado === "locked"/);
  assert.match(modal, /Guardar com reabertura autorizada/);
  assert.match(modal, /periodReadOnly/);
  assert.match(modal, /disciplina_ativa/);
  const api = source("app/api/secretaria/notas/route.ts");
  assert.match(api, /authorizeTurmasManage/);
  assert.match(api, /lancar_notas_batch/);
  assert.match(api, /Past\/locked writes are adjudicated by the database trigger/);
});
