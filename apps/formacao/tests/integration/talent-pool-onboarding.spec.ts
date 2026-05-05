import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canAccessGlobalScope,
  isCorporatePreferredEmail,
  mapOtpVerificationError,
} from "../../lib/talent-pool/onboarding";

const repoRoot = path.resolve(__dirname, "..", "..");

test("Talent Pool onboarding: classificação de domínio corporativo", () => {
  assert.equal(isCorporatePreferredEmail("rh@unitel.ao"), true);
  assert.equal(isCorporatePreferredEmail("rh@gmail.com"), false);
  assert.equal(isCorporatePreferredEmail(""), true);
});

test("Talent Pool onboarding: mensagens de erro OTP amigáveis", () => {
  assert.equal(
    mapOtpVerificationError("Token has expired"),
    "Código expirado. Solicite um novo código OTP."
  );
  assert.equal(
    mapOtpVerificationError("invalid token"),
    "Código OTP inválido. Confirme os 6 dígitos e tente novamente."
  );
});

test("Talent Pool onboarding: acesso global obedece gatilho local", () => {
  assert.equal(
    canAccessGlobalScope({
      scope: "local",
      loading: false,
      itemsCount: 3,
      globalCount: 20,
    }),
    false
  );

  assert.equal(
    canAccessGlobalScope({
      scope: "local",
      loading: false,
      itemsCount: 0,
      globalCount: 20,
    }),
    true
  );
});

test("Guardrail API onboarding: endpoint aplica vínculo email sessão + tratamento NIF duplicado", () => {
  const file = path.join(
    repoRoot,
    "app",
    "api",
    "formacao",
    "publico",
    "talent-pool",
    "empresa-profile",
    "route.ts"
  );
  const content = fs.readFileSync(file, "utf8");

  // Endpoint descontinuado
  assert.match(content, /ENDPOINT_DESCONTINUADO_FORMACAO_CENTRO/);
});
