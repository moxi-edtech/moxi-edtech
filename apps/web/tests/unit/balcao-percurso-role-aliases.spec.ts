import test from "node:test";
import assert from "node:assert/strict";
import { roleMatchesAllowedRoles } from "../../src/lib/permissions";

for (const role of ["admin_secretaria", "admin_secretario"]) {
  test(`${role} reaches the installed secretaria payment gate without inheriting admin privileges`, () => {
    const paymentRoles = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"];
    assert.equal(roleMatchesAllowedRoles(role, paymentRoles), true);
    assert.equal(roleMatchesAllowedRoles(role, ["admin"]), false);
    assert.equal(roleMatchesAllowedRoles(role, ["secretaria"], "formacao"), false);
  });
}
test("individual recovery does not grant teachers or students payment permissions", () => {
  for (const role of ["professor", "aluno", "guest"]) assert.equal(roleMatchesAllowedRoles(role, ["secretaria"]), false);
});
