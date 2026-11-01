import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BALCAO_ACTION_REGISTRY } from "../../src/lib/balcao/action-registry";

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
