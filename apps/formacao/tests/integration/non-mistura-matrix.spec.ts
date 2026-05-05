import test from "node:test";
import assert from "node:assert/strict";
import {
  mapTenantTypeFromDb,
} from "../../lib/navigation-engine";
import { decideProductAccess } from "../../lib/product-access";
import { normalizeRoleForTenant } from "../../lib/role-semantics";

type EvalResult =
  | { outcome: "allow" }
  | { outcome: "deny"; reason: "product_mismatch" | "role_mismatch" }
  | { outcome: "redirect"; target: string };

const ROLE_RULES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/mentor", roles: ["solo_admin", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/secretaria", roles: ["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/financeiro", roles: ["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/agenda", roles: ["formador", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/honorarios", roles: ["formador", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/meus-cursos", roles: ["formando", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/pagamentos", roles: ["formando", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/conquistas", roles: ["formando", "formacao_admin", "super_admin", "global_admin"] },
  { prefix: "/loja-cursos", roles: ["formando", "formacao_admin", "super_admin", "global_admin"] },
];

function hasRoleAccess(role: string, pathname: string): boolean {
  for (const rule of ROLE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      return rule.roles.includes(role);
    }
  }
  return true;
}

function evaluateProtectedPath(tenantTypeDb: "k12" | "formacao" | "solo_creator", role: string, pathname: string): EvalResult {
  const mappedTenantType = mapTenantTypeFromDb(tenantTypeDb);
  const productDecision = decideProductAccess(mappedTenantType, pathname);

  if (productDecision.action === "deny") {
    return { outcome: "deny", reason: "product_mismatch" };
  }
  if (productDecision.action === "redirect") {
    return { outcome: "redirect", target: productDecision.target };
  }
  const normalizedRole = normalizeRoleForTenant(role, tenantTypeDb);
  if (!normalizedRole) return { outcome: "deny", reason: "role_mismatch" };
  return hasRoleAccess(normalizedRole, pathname) ? { outcome: "allow" } : { outcome: "deny", reason: "role_mismatch" };
}

test("Matriz integração: CENTER admin sem mistura com SOLO", () => {
  const allow = evaluateProtectedPath("formacao", "formacao_admin", "/admin/dashboard");
  assert.equal(allow.outcome, "allow");

  const allowLegacyAdmin = evaluateProtectedPath("formacao", "admin", "/admin/dashboard");
  assert.equal(allowLegacyAdmin.outcome, "allow");

  const denySolo = evaluateProtectedPath("formacao", "formacao_admin", "/mentor/dashboard");
  assert.deepEqual(denySolo, { outcome: "deny", reason: "product_mismatch" });
});

test("Matriz integração: CENTER secretaria com role_mismatch em financeiro", () => {
  const allow = evaluateProtectedPath("formacao", "formacao_secretaria", "/secretaria/inbox");
  assert.equal(allow.outcome, "allow");

  const denyRole = evaluateProtectedPath("formacao", "formacao_secretaria", "/financeiro/dashboard");
  assert.deepEqual(denyRole, { outcome: "deny", reason: "role_mismatch" });
});

test("Matriz integração: CENTER financeiro com role_mismatch em secretaria", () => {
  const allow = evaluateProtectedPath("formacao", "formacao_financeiro", "/financeiro/dashboard");
  assert.equal(allow.outcome, "allow");

  const denyRole = evaluateProtectedPath("formacao", "formacao_financeiro", "/secretaria/catalogo-cursos");
  assert.deepEqual(denyRole, { outcome: "deny", reason: "role_mismatch" });
});

test("Matriz integração: formador CENTER sem acesso admin e sem mistura SOLO", () => {
  const allow = evaluateProtectedPath("formacao", "formador", "/agenda");
  assert.equal(allow.outcome, "allow");

  const denyAdmin = evaluateProtectedPath("formacao", "formador", "/admin/dashboard");
  assert.deepEqual(denyAdmin, { outcome: "deny", reason: "role_mismatch" });

  const denySolo = evaluateProtectedPath("formacao", "formador", "/mentor/dashboard");
  assert.deepEqual(denySolo, { outcome: "deny", reason: "product_mismatch" });
});

test("Matriz integração: SOLO_CREATOR com redirect legado e bloqueio financeiro CENTER", () => {
  const allow = evaluateProtectedPath("solo_creator", "mentor", "/mentor/dashboard");
  assert.equal(allow.outcome, "allow");

  const redirectLegacy = evaluateProtectedPath("solo_creator", "mentor", "/admin/dashboard");
  assert.deepEqual(redirectLegacy, { outcome: "redirect", target: "/mentor/dashboard" });

  const denyFinanceiro = evaluateProtectedPath("solo_creator", "mentor", "/financeiro/dashboard");
  assert.deepEqual(denyFinanceiro, { outcome: "deny", reason: "product_mismatch" });
});
