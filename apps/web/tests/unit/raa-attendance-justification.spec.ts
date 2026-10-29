import test from "node:test";
import assert from "node:assert/strict";
import { isUnjustifiedRaaAbsence } from "../../src/lib/academico/raa-attendance-justification";

test("falta sem aprovação formal conta no limite legal do RAA", () => {
  assert.equal(isUnjustifiedRaaAbsence({ id: "f1", status: "falta" }, new Set()), true);
  assert.equal(isUnjustifiedRaaAbsence({ id: "f1", status: "ausente" }, new Set()), true);
});
test("pedido aprovado retira apenas a falta exata do cômputo injustificado", () => {
  assert.equal(isUnjustifiedRaaAbsence({ id: "f1", status: "falta" }, new Set(["f1"])), false);
  assert.equal(isUnjustifiedRaaAbsence({ id: "f2", status: "falta" }, new Set(["f1"])), true);
  assert.equal(isUnjustifiedRaaAbsence({ id: "f1", status: "presente" }, new Set()), false);
});
