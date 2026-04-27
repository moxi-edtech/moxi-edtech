import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessGlobalScope,
  mapOtpVerificationError,
  resolveOnboardingWelcomeMessage,
} from "../../lib/talent-pool/onboarding";

test("E2E onboarding matrix: rede global fica bloqueada enquanto há resultados locais", () => {
  const unlocked = canAccessGlobalScope({
    scope: "local",
    loading: false,
    itemsCount: 2,
    globalCount: 50,
  });
  assert.equal(unlocked, false);
});

test("E2E onboarding matrix: rede global desbloqueia quando local esgota", () => {
  const unlocked = canAccessGlobalScope({
    scope: "local",
    loading: false,
    itemsCount: 0,
    globalCount: 50,
  });
  assert.equal(unlocked, true);
});

test("E2E onboarding matrix: em escopo global o acesso permanece liberado", () => {
  const unlocked = canAccessGlobalScope({
    scope: "global",
    loading: false,
    itemsCount: 5,
    globalCount: 50,
  });
  assert.equal(unlocked, true);
});

test("E2E onboarding matrix: copy de boas-vindas muda por status de verificação", () => {
  const verifiedMessage = resolveOnboardingWelcomeMessage(true);
  const pendingMessage = resolveOnboardingWelcomeMessage(false);

  assert.match(verifiedMessage, /verificada automaticamente/i);
  assert.match(pendingMessage, /conta está em análise/i);
});

test("E2E onboarding matrix: OTP expirado e inválido retornam mensagens distintas", () => {
  assert.equal(
    mapOtpVerificationError("token has expired"),
    "Código expirado. Solicite um novo código OTP."
  );
  assert.equal(
    mapOtpVerificationError("invalid otp token"),
    "Código OTP inválido. Confirme os 6 dígitos e tente novamente."
  );
});
