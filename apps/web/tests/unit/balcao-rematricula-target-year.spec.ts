import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBalcaoRematriculaTargetYear,
  shouldBlockClosedRematriculaWindow,
} from "../../src/lib/rematricula/balcao-target-year";

test("2026 representa 2026/2027 e não salta para 2027/2028", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2026 }), 2026);
});

test("2025/2026 e anos futuros só são operados quando a sessão é seleccionada", () => {
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2025 }), 2025);
  assert.equal(resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 2027 }), 2027);
});

test("ano inválido não é usado como destino", () => {
  assert.throws(() => resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: NaN }));
  assert.throws(() => resolveBalcaoRematriculaTargetYear({ selectedAcademicYear: 0 }));
});

test("janela encerrada não bloqueia nem novas rematrículas nem reconciliação", () => {
  for (const windowOpen of [true, false]) {
    for (const hasExistingOperationForTarget of [true, false]) {
      assert.equal(shouldBlockClosedRematriculaWindow({
        windowOpen, hasExistingOperationForTarget,
      }), false);
    }
  }
});
