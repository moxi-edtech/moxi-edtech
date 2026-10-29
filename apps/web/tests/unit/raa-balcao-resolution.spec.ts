import test from "node:test";
import assert from "node:assert/strict";
import { raaBalcaoPlan } from "../../src/lib/rematricula/raa-balcao-resolution";

test("os sete bloqueios RAA têm resolução contextual e nunca autorizam bypass", () => {
  const matrix = {
    ACADEMIC_PENDING: "nota",
    ACADEMIC_REVIEW_REQUIRED: "reapreciacao",
    ACADEMIC_CONDITIONAL_BLOCKED: "reapreciacao",
    ACADEMIC_ATTENDANCE_REVIEW_REQUIRED: "justificacao",
    ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED: "disciplina",
    ACADEMIC_NOT_APPROVED: "rever_resultado",
    ACADEMIC_CYCLE_COMPLETED: "documentos",
  } as const;
  for (const [status, action] of Object.entries(matrix)) {
    const plan = raaBalcaoPlan(status as keyof typeof matrix);
    assert.equal(plan?.acao, action, status);
    assert.equal(plan?.permiteRematricula, false, status);
  }
});
test("aprovação e retenção comum seguem o wizard, sem novo bypass", () => {
  for (const status of ["READY", "ALREADY_COMPLETED", "DEBT_BLOCKED", "CHECKING"] as const) {
    assert.equal(raaBalcaoPlan(status), null);
  }
});
