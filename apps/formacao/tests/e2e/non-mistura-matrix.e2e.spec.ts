import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantRoute } from "../../../auth/lib/resolveTenantRoute";
import { decideProductAccess } from "../../lib/product-access";
import { mapTenantTypeFromDb } from "../../lib/navigation-engine";

type TenantInput = {
  tenantId: string;
  tenantName: string;
  tenantType: "k12" | "formacao" | "solo_creator";
  role: string;
};

function evaluateProductBoundary(tenant: TenantInput, pathname: string) {
  const mappedTenant = mapTenantTypeFromDb(tenant.tenantType);
  return decideProductAccess(mappedTenant, pathname);
}

test("E2E matrix: login solo_creator cai no canônico solo e bloqueia rotas center", () => {
  const soloTenant: TenantInput = {
    tenantId: "solo-1",
    tenantName: "Solo Workspace",
    tenantType: "solo_creator",
    role: "mentor",
  };

  const destination = resolveTenantRoute(soloTenant);
  assert.equal(destination.product, "formacao");
  assert.equal(destination.path, "/mentor/dashboard");

  const toLegacyAdmin = evaluateProductBoundary(soloTenant, "/admin/dashboard");
  assert.equal(toLegacyAdmin.action, "redirect");
  if (toLegacyAdmin.action === "redirect") {
    assert.equal(toLegacyAdmin.target, "/mentor/dashboard");
  }

  const toFinanceiroCenter = evaluateProductBoundary(soloTenant, "/financeiro/dashboard");
  assert.equal(toFinanceiroCenter.action, "deny");
});

test("E2E matrix: login center admin mantém namespace center e bloqueia /mentor", () => {
  const centerAdmin: TenantInput = {
    tenantId: "center-1",
    tenantName: "Center Workspace",
    tenantType: "formacao",
    role: "formacao_admin",
  };

  const destination = resolveTenantRoute(centerAdmin);
  assert.equal(destination.product, "formacao");
  assert.equal(destination.path, "/admin/dashboard");

  const toMentor = evaluateProductBoundary(centerAdmin, "/mentor/dashboard");
  assert.equal(toMentor.action, "deny");

  const toAdmin = evaluateProductBoundary(centerAdmin, "/admin/dashboard");
  assert.equal(toAdmin.action, "allow");
});

test("E2E matrix: em conta multi-contexto, seleção explícita define o produto final", () => {
  const tenants: TenantInput[] = [
    {
      tenantId: "center-1",
      tenantName: "Center Workspace",
      tenantType: "formacao",
      role: "formacao_admin",
    },
    {
      tenantId: "solo-1",
      tenantName: "Solo Workspace",
      tenantType: "solo_creator",
      role: "mentor",
    },
  ];

  const chosenSolo = tenants[1];
  const destination = resolveTenantRoute(chosenSolo);
  assert.equal(destination.path, "/mentor/dashboard");

  const toCenterNamespace = evaluateProductBoundary(chosenSolo, "/secretaria/catalogo-cursos");
  assert.equal(toCenterNamespace.action, "deny");
});
