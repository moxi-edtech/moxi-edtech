import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/secretaria/PautaRapidaModal.tsx", "utf8");
const gradePage = readFileSync("src/app/secretaria/(portal-secretaria)/notas/page.tsx", "utf8");
const afterEnrollment = readFileSync("src/components/secretaria/EnrollmentPostActionModal.tsx", "utf8");
const gradeWriter = readFileSync("src/app/api/secretaria/notas/route.ts", "utf8");
const picker = readFileSync("src/app/api/secretaria/notas/turmas/route.ts", "utf8");

test("Balcão turma picker is scoped to verified academic year, not local clock or enrollment view", () => {
  assert.match(modal, /loadAllGradeTurmas\(fetch, academicYearId\)/);
  assert.doesNotMatch(modal, /new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(modal, /turmas-simples/);
  assert.match(picker, /resolveAcademicYearContext/);
  assert.match(picker, /authorizeTurmasManage/);
  assert.match(picker, /context\.escolaId !== escolaId/);
});

test("standalone secretaria grade page resolves active year if no URL param", () => {
  assert.match(gradePage, /fetch\("\/api\/academic-context" \+ suffix/);
  assert.match(gradePage, /loadAllGradeTurmas\(fetch, academicYearId\)/);
  assert.doesNotMatch(gradePage, /turmas-simples/);
});

test("all three grade surfaces send verified year and honor server-side write guard", () => {
  assert.match(modal, /ano_letivo_id: academicYearId/);
  assert.match(gradePage, /ano_letivo_id: academicYearId/);
  assert.match(afterEnrollment, /ano_letivo_id: academicYearId/);
  assert.match(afterEnrollment, /notaMaxima === null/);
  assert.match(afterEnrollment, /pauta-grid/);
  assert.match(gradeWriter, /operation: 'WRITE'/);
  assert.match(gradeWriter, /ACTIVE_ENROLLMENT_REQUIRED/);
  assert.match(gradeWriter, /authorizeTurmasManage/);
});
