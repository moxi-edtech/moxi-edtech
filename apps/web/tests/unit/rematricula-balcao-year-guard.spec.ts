import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveBalcaoRematriculaTargetYear } from "../../src/lib/rematricula/balcao-target-year";

test("destino usa matrícula mais recente e não o ano ativo da escola", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2025,
    hasCurrentAcademicYearOperation: false,
    openWindowAcademicYear: null,
  }), 2026);
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2026,
    hasCurrentAcademicYearOperation: false,
    openWindowAcademicYear: null,
  }), 2027);
});

test("pedido existente continua no ano que originou a operação", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({
    sourceAcademicYear: 2026,
    latestStudentAcademicYear: 2026,
    hasCurrentAcademicYearOperation: true,
    openWindowAcademicYear: null,
  }), 2026);
});

test("API nunca inventa sessão do ano destino nem omite o estado de bloqueio", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/balcao/rematriculas/status/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!targetScope\)/);
  assert.match(route, /status: "TARGET_YEAR_NOT_CONFIGURED"/);
  assert.match(route, /ano_letivo: null/);
  assert.doesNotMatch(route, /targetScope\?\.id\s*\?\?\s*academicContext\.anoLetivoId/);
});

test("API de turmas devolve a orientação RAA mesmo que a view não devolva linhas", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/turmas-simples/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(matriculaId && alunoId && sessionId && anoLetivo\)/);
  assert.doesNotMatch(route, /if \(matriculaId && alunoId && sessionId && anoLetivo && items\.length > 0\)/);
});
