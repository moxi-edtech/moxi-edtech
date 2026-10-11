import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBalcaoRematriculaTargetYear,
  shouldBlockClosedRematriculaWindow,
} from "../../src/lib/rematricula/balcao-target-year";

test("operação existente do ano actual impede salto prematuro para o ano seguinte", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2026,
    openWindowAcademicYear: null,
    hasCurrentAcademicYearOperation: true,
  }), 2026);
});

test("janela futura aberta tem precedência sobre operação concluída do ano actual", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2026,
    openWindowAcademicYear: 2027,
    hasCurrentAcademicYearOperation: true,
  }), 2027);
});

test("sem operação existente o Balcão aponta para o próximo ano do aluno", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2026,
    openWindowAcademicYear: null,
    hasCurrentAcademicYearOperation: false,
  }), 2027);
});

test("janela fechada não bloqueia reconciliação de operação já existente", () => {
  assert.equal(shouldBlockClosedRematriculaWindow({
    windowOpen: false,
    hasExistingOperationForTarget: true,
  }), false);
  assert.equal(shouldBlockClosedRematriculaWindow({
    windowOpen: false,
    hasExistingOperationForTarget: false,
  }), true);
});
