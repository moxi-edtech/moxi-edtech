import test from "node:test";
import assert from "node:assert/strict";
import { decideProductAccess } from "../../lib/product-access";

test("SOLO_CREATOR: legado /admin/cohorts redireciona para /mentor/mentorias", () => {
  const decision = decideProductAccess("SOLO_CREATOR", "/admin/cohorts");
  assert.equal(decision.action, "redirect");
  if (decision.action !== "redirect") return;
  assert.equal(decision.target, "/mentor/mentorias");
});

test("SOLO_CREATOR: legado /admin/dashboard redireciona para /mentor/dashboard", () => {
  const decision = decideProductAccess("SOLO_CREATOR", "/admin/dashboard");
  assert.equal(decision.action, "redirect");
  if (decision.action !== "redirect") return;
  assert.equal(decision.target, "/mentor/dashboard");
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
