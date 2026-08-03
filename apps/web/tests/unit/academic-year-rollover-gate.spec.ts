import test from "node:test";
import assert from "node:assert/strict";

import {
  canManageAcademicYearRollover,
  getLuandaDate,
  isAcademicYearExpired,
} from "../../src/lib/operacoes-academicas/academic-year-rollover-gate";

test("considera o ano pendente apenas depois da sua data final", () => {
  assert.equal(isAcademicYearExpired("2026-07-31", "2026-07-31"), false);
  assert.equal(isAcademicYearExpired("2026-07-31", "2026-08-01"), true);
});

test("calcula a data civil da escola no fuso de Angola", () => {
  assert.equal(getLuandaDate(new Date("2026-08-02T23:30:00.000Z")), "2026-08-03");
});

test("abre a virada apenas para os perfis responsáveis", () => {
  for (const role of [
    "admin",
    "admin_escola",
    "staff_admin",
    "admin_financeiro",
    "diretor",
    "super_admin",
    "global_admin",
  ]) {
    assert.equal(canManageAcademicYearRollover(role), true, `${role} deve abrir o wizard`);
  }

  for (const role of ["secretaria", "financeiro", "professor", "aluno", null]) {
    assert.equal(canManageAcademicYearRollover(role), false, `${role} não deve abrir o wizard`);
  }
});
