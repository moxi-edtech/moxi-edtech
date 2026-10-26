import assert from "node:assert/strict";
import test from "node:test";
import { resolveCheckoutOriginMatricula } from "../../src/lib/financeiro/checkout-origin";

test("single post-rollover monthly payment uses the charge's historical matrícula", () => {
  const origin = resolveCheckoutOriginMatricula({
    tipo: "mensalidade",
    origemMatriculaId: "previous-school-year-enrollment",
    matriculaId: "current-school-year-enrollment",
  });
  assert.equal(origin, "previous-school-year-enrollment");
});

test("single post-rollover monthly payment never fabricates a missing matrícula", () => {
  assert.equal(
    resolveCheckoutOriginMatricula({ tipo: "mensalidade" }),
    null,
  );
});

test("single checkout retains ordinary matrícula context when no item origin is provided", () => {
  assert.equal(
    resolveCheckoutOriginMatricula({
      tipo: "mensalidade",
      matriculaId: "selected-enrollment",
    }),
    "selected-enrollment",
  );
});

test("a service item cannot be passed off as a monthly enrollment", () => {
  assert.equal(
    resolveCheckoutOriginMatricula({
      tipo: "servico",
      origemMatriculaId: "untrusted-monthly-origin",
      matriculaId: "selected-enrollment",
    }),
    null,
  );
});
