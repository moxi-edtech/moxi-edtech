import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveSuperAdminSchoolRoleAssignment,
  normalizeSuperAdminPapelEscolaInput,
} from "../../src/lib/superAdminRoleAssignment";

test("normaliza apelidos legados de papel da escola no fluxo do super admin", () => {
  assert.equal(normalizeSuperAdminPapelEscolaInput("secretario"), "secretaria");
  assert.equal(normalizeSuperAdminPapelEscolaInput("diretor"), "admin_escola");
  assert.equal(normalizeSuperAdminPapelEscolaInput("coordenador"), "admin_escola");
});

test("preserva papeis compostos no update do super admin", () => {
  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ papelEscola: "secretaria_financeiro" }),
    {
      papel: "secretaria_financeiro",
      profileRole: "secretaria_financeiro",
    }
  );

  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ papelEscola: "admin_financeiro" }),
    {
      papel: "admin_financeiro",
      profileRole: "admin_financeiro",
    }
  );
});

test("converte papeis escolares administrativos para o role global correto", () => {
  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ papelEscola: "admin_escola" }),
    {
      papel: "admin_escola",
      profileRole: "admin",
    }
  );

  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ papelEscola: "staff_admin" }),
    {
      papel: "staff_admin",
      profileRole: "admin",
    }
  );
});

test("aceita role escolar como fallback quando papel_escola nao vem no payload", () => {
  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ role: "secretaria_financeiro" }),
    {
      papel: "secretaria_financeiro",
      profileRole: "secretaria_financeiro",
    }
  );

  assert.deepEqual(
    deriveSuperAdminSchoolRoleAssignment({ role: "admin_escola" }),
    {
      papel: "admin_escola",
      profileRole: "admin",
    }
  );
});
