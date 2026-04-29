import test from "node:test";
import assert from "node:assert/strict";
import { decideProductAccess } from "../../lib/product-access";

test("SOLO_CREATOR: /admin/cohorts é negado no app Formação Centro", () => {
  const decision = decideProductAccess("SOLO_CREATOR", "/admin/cohorts");
  assert.equal(decision.action, "deny");
});

test("SOLO_CREATOR: /admin/dashboard é negado no app Formação Centro", () => {
  const decision = decideProductAccess("SOLO_CREATOR", "/admin/dashboard");
  assert.equal(decision.action, "deny");
});

test("SOLO_CREATOR: namespace financeiro center-only é negado", () => {
  const decision = decideProductAccess("SOLO_CREATOR", "/financeiro/dashboard");
  assert.equal(decision.action, "deny");
});

test("CENTER: namespace /mentor é negado por produto", () => {
  const decision = decideProductAccess("CENTER", "/mentor/dashboard");
  assert.equal(decision.action, "deny");
});

test("CENTER: namespace /admin é permitido", () => {
  const decision = decideProductAccess("CENTER", "/admin/dashboard");
  assert.equal(decision.action, "allow");
});
