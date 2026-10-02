import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartRematricula,
  classifyRematriculaAcademicEligibility,
} from "../../src/lib/rematricula/eligibility";

test("transitou é elegível para rematrícula regular", () => {
  assert.deepEqual(
    classifyRematriculaAcademicEligibility({
      decision: "transitou",
      destino: "proxima_etapa",
    }),
    {
      eligible: true,
      code: "ACADEMIC_READY",
      mode: "regular",
      reason: "O RAA autorizou a progressão para a etapa seguinte.",
      disciplinaIdsPendentes: [],
    },
  );
});

test("inscrição condicional pode avançar quando o RAA autoriza a próxima etapa", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "inscricao_condicional",
    destino: "proxima_etapa",
    efetivacaoMatriculaBloqueada: false,
    disciplinaIdsPendentes: ["fis"],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.code, "ACADEMIC_CONDITIONAL");
  assert.equal(result.mode, "conditional");
  assert.deepEqual(result.disciplinaIdsPendentes, ["fis"]);
});

test("inscrição condicional bloqueada pelo RAA não pode ser efetivada", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "inscricao_condicional",
    destino: "mesma_etapa",
    efetivacaoMatriculaBloqueada: true,
    disciplinaIdsPendentes: ["fis"],
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_CONDITIONAL_BLOCKED");
});

test("notas/dados pendentes não viram aprovação implícita", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "pendente",
    destino: "aguardar_dados",
    disciplinaIdsPendentes: ["mat"],
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_RESULT_PENDING");
  assert.deepEqual(result.disciplinaIdsPendentes, ["mat"]);
});

test("recurso permanece bloqueado até a decisão RAA permitir progressão", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "recurso",
    destino: "mesma_etapa",
    disciplinaIdsPendentes: ["fis"],
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_REVIEW_REQUIRED");
});

test("retido pode rematricular para repetir exatamente a mesma etapa", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "retido",
    destino: "mesma_etapa",
    efetivacaoMatriculaBloqueada: true,
  });

  assert.equal(result.eligible, true);
  assert.equal(result.code, "ACADEMIC_REPEAT");
  assert.equal(result.mode, "repeat");
});

test("retido nunca pode usar uma turma da etapa seguinte", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "retido",
    destino: "proxima_etapa",
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_NOT_APPROVED");
});

test("retenção por faltas exige validação escolar explícita", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "retido_por_faltas",
    destino: "mesma_etapa",
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_ATTENDANCE_REVIEW_REQUIRED");
});

test("retenção por indisciplina exige decisão administrativa", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "retido_por_indisciplina",
    destino: "mesma_etapa",
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED");
});

test("conclusão de ciclo não cria rematrícula", () => {
  const result = classifyRematriculaAcademicEligibility({
    decision: "concluiu",
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACADEMIC_CYCLE_COMPLETED");
});

test("progressão autorizada com saldo em aberto continua bloqueada financeiramente", () => {
  const result = canStartRematricula({
    academic: {
      decision: "inscricao_condicional",
      destino: "proxima_etapa",
      efetivacaoMatriculaBloqueada: false,
      disciplinaIdsPendentes: ["fis"],
    },
    debtTotal: 15000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.academic.code, "ACADEMIC_CONDITIONAL");
  assert.equal(result.financial?.code, "REMATRICULA_DEBT_REQUIRED");
});

test("progressão condicional autorizada e sem dívida pode iniciar rematrícula", () => {
  const result = canStartRematricula({
    academic: {
      decision: "inscricao_condicional",
      destino: "proxima_etapa",
      efetivacaoMatriculaBloqueada: false,
      disciplinaIdsPendentes: ["fis"],
    },
    debtTotal: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.academic.mode, "conditional");
});


test("retido sem dívida pode iniciar repetição", () => {
  const result = canStartRematricula({
    academic: {
      decision: "retido",
      destino: "mesma_etapa",
      efetivacaoMatriculaBloqueada: true,
    },
    debtTotal: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.academic.mode, "repeat");
});

test("retido com dívida vencida continua bloqueado apenas financeiramente", () => {
  const result = canStartRematricula({
    academic: {
      decision: "retido",
      destino: "mesma_etapa",
      efetivacaoMatriculaBloqueada: true,
    },
    debtTotal: 12000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.academic.code, "ACADEMIC_REPEAT");
  assert.equal(result.financial?.code, "REMATRICULA_DEBT_REQUIRED");
});
