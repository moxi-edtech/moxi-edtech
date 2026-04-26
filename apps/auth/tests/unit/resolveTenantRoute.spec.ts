import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantRoute } from "../../lib/resolveTenantRoute";

test("resolveTenantRoute: solo_creator aponta para dashboard de mentor", () => {
  const resolved = resolveTenantRoute({
    tenantId: "tenant-solo",
    tenantName: "Solo",
    tenantType: "solo_creator",
    role: "mentor",
  });

  assert.equal(resolved.product, "formacao");
  assert.equal(resolved.path, "/mentor/dashboard");
});

test("resolveTenantRoute: formacao_financeiro aponta para financeiro", () => {
  const resolved = resolveTenantRoute({
    tenantId: "tenant-center",
    tenantName: "Center",
    tenantType: "formacao",
    role: "formacao_financeiro",
  });

  assert.equal(resolved.product, "formacao");
  assert.equal(resolved.path, "/financeiro/dashboard");
});

test("resolveTenantRoute: k12 mantém handoff para redirect", () => {
  const resolved = resolveTenantRoute({
    tenantId: "tenant-k12",
    tenantName: "K12",
    tenantType: "k12",
    role: "admin",
  });

  assert.equal(resolved.product, "k12");
  assert.equal(resolved.path, "/redirect");
});
