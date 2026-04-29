import test from "node:test";
import assert from "node:assert/strict";
import {
  CENTER_NAV_CONFIG,
  getAuthorizedNavigation,
  isCenterAdminDashboardType,
  isCriticalTenantMappingMismatch,
  mapTenantTypeFromDb,
  mapUserRoleFromDb,
  shouldRedirectToK12FromFormacaoApp,
} from "../../lib/navigation-engine";

test("Caso A: admin formacao mapeia para CENTER e mostra menu de gestão/financeiro", () => {
  const mappedType = mapTenantTypeFromDb("formacao");
  const mappedRole = mapUserRoleFromDb("formacao_admin");
  const nav = getAuthorizedNavigation(CENTER_NAV_CONFIG, mappedType, mappedRole);
  const hrefs = nav.map((item) => item.href);

  assert.equal(mappedType, "CENTER");
  assert.equal(mappedRole, "ADMIN");
  assert.ok(isCenterAdminDashboardType(mappedType));
  assert.ok(hrefs.includes("/admin/dashboard"));
  assert.equal(hrefs.includes("/mentor/dashboard"), false);
  assert.ok(hrefs.includes("/financeiro/dashboard"));
  assert.ok(hrefs.includes("/admin/onboarding"));
});

test("Caso B: solo_creator permanece mapeado, sem navegação de centro", () => {
  const mappedType = mapTenantTypeFromDb("solo_creator");
  const mappedRole = mapUserRoleFromDb("mentor");
  const nav = getAuthorizedNavigation(CENTER_NAV_CONFIG, mappedType, mappedRole);
  const hrefs = nav.map((item) => item.href);

  assert.equal(mappedType, "SOLO_CREATOR");
  assert.equal(mappedRole, "MENTOR");
  assert.equal(isCenterAdminDashboardType(mappedType), false);
  assert.equal(hrefs.includes("/mentor/dashboard"), false);
  assert.equal(hrefs.includes("/mentor/mentorias/nova"), false);
  assert.equal(hrefs.includes("/admin/cohorts"), false);
  assert.equal(hrefs.includes("/financeiro/dashboard"), false);
});

test("Caso C: tenant mismatch em app formacao redireciona corretamente", () => {
  assert.equal(shouldRedirectToK12FromFormacaoApp("k12"), true);
  assert.equal(shouldRedirectToK12FromFormacaoApp("formacao"), false);
  assert.equal(shouldRedirectToK12FromFormacaoApp("solo_creator"), false);
  assert.equal(shouldRedirectToK12FromFormacaoApp(null), false);
});

test("Alerta crítico só dispara em combinação inválida formacao -> SOLO_CREATOR", () => {
  assert.equal(isCriticalTenantMappingMismatch("formacao", "SOLO_CREATOR"), true);
  assert.equal(isCriticalTenantMappingMismatch("formacao", "CENTER"), false);
  assert.equal(isCriticalTenantMappingMismatch("solo_creator", "SOLO_CREATOR"), false);
  assert.equal(isCriticalTenantMappingMismatch("k12", "K12"), false);
});
