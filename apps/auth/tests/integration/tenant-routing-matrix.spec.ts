import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantRoute } from "../../lib/resolveTenantRoute";

test("Integração auth: role matrix para tenant formacao", () => {
  const admin = resolveTenantRoute({
    tenantId: "t-1",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formacao_admin",
  });
  assert.deepEqual(admin, { product: "formacao", path: "/admin/dashboard" });

  const secretaria = resolveTenantRoute({
    tenantId: "t-1",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formacao_secretaria",
  });
  assert.deepEqual(secretaria, { product: "formacao", path: "/secretaria/catalogo-cursos" });

  const financeiro = resolveTenantRoute({
    tenantId: "t-1",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formacao_financeiro",
  });
  assert.deepEqual(financeiro, { product: "formacao", path: "/financeiro/dashboard" });

  const formador = resolveTenantRoute({
    tenantId: "t-1",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formador",
  });
  assert.deepEqual(formador, { product: "formacao", path: "/agenda" });

  const formando = resolveTenantRoute({
    tenantId: "t-1",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formando",
  });
  assert.deepEqual(formando, { product: "formacao", path: "/meus-cursos" });
});

test("Integração auth: solo_creator ignora namespace center no pós-login", () => {
  const solo = resolveTenantRoute({
    tenantId: "solo-1",
    tenantName: "Solo",
    tenantType: "solo_creator",
    role: "mentor",
  });

  assert.deepEqual(solo, { product: "formacao", path: "/mentor/dashboard" });
});

test("Integração auth: k12 mantém handoff para redirect canônico", () => {
  const k12 = resolveTenantRoute({
    tenantId: "k12-1",
    tenantName: "K12",
    tenantType: "k12",
    role: "admin",
  });

  assert.deepEqual(k12, { product: "k12", path: "/redirect" });
});

