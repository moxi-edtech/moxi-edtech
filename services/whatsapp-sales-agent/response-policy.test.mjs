import test from "node:test";
import assert from "node:assert/strict";
import { applyResponsePolicy, SAFE_HANDOFF_MESSAGE } from "./response-policy.mjs";

test("bloqueia horário inventado quando não há configuração oficial", () => {
  const result = applyResponsePolicy(
    { reply: "O nosso atendimento começa às 10h.", handoff: false, followUpHours: 24 },
    { businessHours: "" },
  );

  assert.equal(result.reply, SAFE_HANDOFF_MESSAGE);
  assert.equal(result.handoff, true);
  assert.equal(result.followUpHours, 0);
});

test("permite horário somente quando está explicitamente configurado", () => {
  const result = applyResponsePolicy(
    { reply: "Atendemos das 08h às 17h.", handoff: false, followUpHours: 24 },
    { businessHours: "segunda a sexta, das 08:00 às 17:00" },
  );

  assert.equal(result.reply, "Atendemos das 08h às 17h.");
  assert.equal(result.followUpHours, 24);
});

test("não agenda follow-up quando a decisão exige humano", () => {
  const result = applyResponsePolicy(
    { reply: "Vou encaminhar para a equipa.", handoff: true, followUpHours: 48 },
    { businessHours: "" },
  );

  assert.equal(result.followUpHours, 0);
});

test("não sugere ligação fora dos intervalos autorizados", () => {
  const result = applyResponsePolicy(
    { reply: "Posso ligar às 09h para explicar os detalhes.", handoff: false, followUpHours: 24 },
    { businessHours: "08h–17h30", callWindows: "10h–12h, 13h–14h" },
  );

  assert.equal(result.intent, "call_window_unavailable");
  assert.equal(result.handoff, true);
  assert.equal(result.followUpHours, 0);
});
