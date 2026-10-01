import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartRematricula,
  classifyRematriculaAcademicEligibility,
} from "../../src/lib/rematricula/eligibility";

test("apenas resultado transitou é elegível para rematrícula", () => {
  assert.equal(classifyRematriculaAcademicEligibility("transitou").eligible, true);

  for (const decision of [
    "pendente",
    "recurso",
    "inscricao_condicional",
    "retido",
    "retido_por_faltas",
    "retido_por_indisciplina",
    "concluiu",
  ] as const) {
    assert.equal(
      classifyRematriculaAcademicEligibility(decision).eligible,
      false,
      `${decision} não pode iniciar rematrícula`,
    );
  }
});

test("notas pendentes têm estado próprio e não viram aprovação implícita", () => {
  assert.deepEqual(classifyRematriculaAcademicEligibility("pendente"), {
    eligible: false,
    code: "ACADEMIC_RESULT_PENDING",
    reason: "As notas e o resultado académico precisam estar fechados antes da rematrícula.",
  });
});

test("aluno aprovado com dívida continua bloqueado", () => {
  const result = canStartRematricula({ academicDecision: "transitou", debtTotal: 15000 });
  assert.equal(result.ok, false);
  assert.equal(result.academic.code, "ACADEMIC_APPROVED");
  assert.equal(result.financial?.code, "REMATRICULA_DEBT_REQUIRED");
});

test("aluno aprovado e sem dívida pode iniciar rematrícula", () => {
  const result = canStartRematricula({ academicDecision: "transitou", debtTotal: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.academic.code, "ACADEMIC_APPROVED");
});
