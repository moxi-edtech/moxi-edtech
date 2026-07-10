import test from "node:test";
import assert from "node:assert/strict";

import {
  expandAllowedRolesForProduct,
  getDefaultK12PortalPathForRole,
  getPermissionsForRole,
  roleMatchesAllowedRoles,
} from "../../src/lib/permissions";

test("expandAllowedRolesForProduct expande herança composta de financeiro e secretaria no k12", () => {
  assert.deepEqual(
    expandAllowedRolesForProduct(["admin_escola"]).sort(),
    ["admin", "admin_escola", "staff_admin"].sort()
  );

  assert.deepEqual(
    expandAllowedRolesForProduct(["staff_admin"]).sort(),
    ["admin", "admin_escola", "staff_admin"].sort()
  );

  assert.deepEqual(
    expandAllowedRolesForProduct(["financeiro"]).sort(),
    ["admin_financeiro", "financeiro", "secretaria_financeiro"].sort()
  );

  assert.deepEqual(
    expandAllowedRolesForProduct(["secretaria"]).sort(),
    ["secretaria", "secretaria_financeiro"].sort()
  );
});

test("roleMatchesAllowedRoles aplica herança composta do k12 incluindo admin_financeiro em secretaria", () => {
  assert.equal(roleMatchesAllowedRoles("admin", ["admin_escola"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("staff_admin", ["admin_escola"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("admin_escola", ["admin"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("admin_escola", ["staff_admin"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("secretaria_financeiro", ["financeiro"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("secretaria_financeiro", ["secretaria"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("admin_financeiro", ["financeiro"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("admin_financeiro", ["secretaria"], "k12"), true);
  assert.equal(roleMatchesAllowedRoles("admin_financeiro", ["admin_financeiro"], "k12"), true);
});

test("admin_financeiro e secretaria_financeiro recebem permissões completas de financeiro e secretaria", () => {
  const secretariaFinanceiro = getPermissionsForRole("secretaria_financeiro");
  const adminFinanceiro = getPermissionsForRole("admin_financeiro");

  for (const perm of [
    "criar_cobranca",
    "registrar_pagamento",
    "emitir_recibo",
    "criar_matricula",
    "editar_matricula",
    "gerenciar_transferencias",
    "gerenciar_turmas",
    "lançar_notas",
    "registrar_frequencia",
    "emitir_documentos",
  ]) {
    assert.equal(secretariaFinanceiro.has(perm as never), true, `secretaria_financeiro sem ${perm}`);
    assert.equal(adminFinanceiro.has(perm as never), true, `admin_financeiro sem ${perm}`);
  }
});

test("redirects K12 usam semantica central para papeis compostos e financeiro", () => {
  assert.equal(
    getDefaultK12PortalPathForRole("secretaria_financeiro", "curtume"),
    "/escola/curtume/secretaria"
  );
  assert.equal(
    getDefaultK12PortalPathForRole("admin_financeiro", "curtume"),
    "/escola/curtume/operacoes/dashboard"
  );
  assert.equal(
    getDefaultK12PortalPathForRole("financeiro", "curtume"),
    "/escola/curtume/financeiro"
  );
});
