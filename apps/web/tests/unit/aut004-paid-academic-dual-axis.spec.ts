import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { raaBalcaoEffectiveStatus, raaBalcaoPlan } from "../../src/lib/rematricula/raa-balcao-resolution";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("AUT-004: paid, unreconciled pupil still shows unresolved source grade action", () => {
  const status = raaBalcaoEffectiveStatus("RECONCILIATION_REQUIRED", {
    eligible: false, code: "ACADEMIC_RESULT_PENDING",
  });
  assert.equal(status, "ACADEMIC_PENDING");
  assert.equal(raaBalcaoPlan(status)?.acao, "nota");
});

test("AUT-005: paid pupil still has permitted in-place exception resolution", () => {
  const scenarios = [
    ["ACADEMIC_ATTENDANCE_REVIEW_REQUIRED", "justificacao"],
    ["ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED", "disciplina"],
    ["ACADEMIC_REVIEW_REQUIRED", "reapreciacao"],
    ["ACADEMIC_CONDITIONAL_BLOCKED", "reapreciacao"],
    ["ACADEMIC_CYCLE_COMPLETED", "documentos"],
    ["ACADEMIC_NOT_APPROVED", "rever_resultado"],
  ] as const;
  for (const [code, expected] of scenarios) {
    const derived = raaBalcaoEffectiveStatus("PAYMENT_IN_PROGRESS", { eligible: false, code });
    assert.equal(raaBalcaoPlan(derived)?.acao, expected, code);
    assert.equal(raaBalcaoPlan(derived)?.permiteRematricula, false);
  }
});

test("AUT-005: no guessed permission, duplicate enrollment or forged decisions", () => {
  assert.equal(raaBalcaoEffectiveStatus("RECONCILIATION_REQUIRED", null), "RECONCILIATION_REQUIRED");
  assert.equal(raaBalcaoEffectiveStatus("RECONCILIATION_REQUIRED", {
    eligible: false, code: "UNKNOWN_RAA_CODE",
  }), "RECONCILIATION_REQUIRED");
  assert.equal(raaBalcaoEffectiveStatus("RECONCILIATION_REQUIRED", {
    eligible: true, code: "ACADEMIC_RESULT_PENDING",
  }), "RECONCILIATION_REQUIRED");
  for (const paidStatus of ["ALREADY_COMPLETED", "DESTINATION_ENROLLED"] as const) {
    const result = raaBalcaoEffectiveStatus(paidStatus, {
      eligible: false, code: "ACADEMIC_RESULT_PENDING",
    });
    assert.equal(result, paidStatus);
    assert.equal(raaBalcaoPlan(result), null);
  }
});

test("AUT-010: payment state, academic actions and active-student context coexist in Balcao", () => {
  const summary = source("components/secretaria/RematriculaWorkspaceChrome.tsx");
  const raa = source("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  const balc = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(summary, /const academicStatus = raaBalcaoEffectiveStatus\(status, academic\)/);
  assert.match(summary, /paymentAlreadyStarted \? baseDisplay.title/);
  assert.match(summary, /Boolean\(academicPlan\)/);
  assert.match(raa, /raaBalcaoPlan\(raaBalcaoEffectiveStatus\(status, academic\)\)/);
  assert.match(balc, /const academicBlocker = raaBalcaoPlan\(/);
  assert.match(balc, /showAcademicResolution && raaMatriculaId && raaAlunoId/);
  assert.match(balc, /onLancarNota=\{onLancarNota\}/);
  assert.match(balc, /const showAcademicResolution = !paidExistingDestination \|\| Boolean\(academicBlocker\)/);
});
