import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoleForTenant } from "../../lib/role-semantics";

test("solo_creator: mentor/formador mapeiam para solo_admin", () => {
  assert.equal(normalizeRoleForTenant("mentor", "solo_creator"), "solo_admin");
  assert.equal(normalizeRoleForTenant("formador", "solo_creator"), "solo_admin");
  assert.equal(normalizeRoleForTenant("creator", "solo_creator"), "solo_admin");
});

test("center: mentor legado mapeia para formador", () => {
  assert.equal(normalizeRoleForTenant("mentor", "formacao"), "formador");
});

test("roles inválidas retornam null", () => {
  assert.equal(normalizeRoleForTenant("foobar", "formacao"), null);
  assert.equal(normalizeRoleForTenant("", "solo_creator"), null);
});

