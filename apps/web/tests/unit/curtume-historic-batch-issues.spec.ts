import assert from "node:assert/strict";
import test from "node:test";

import { getHistoricBatchIssueAdvice, isHistoricBatchAcademicIssue } from "../../src/lib/academico/curtume-historic-batch-issues";

test("historic 2025 blocking reasons are operational and actionable", () => {
  assert.deepEqual(getHistoricBatchIssueAdvice("NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO"), {
    title: "Notas em conflito",
    nextStep: "Conferir as notas já lançadas com a pauta antes do fecho.",
  });
  assert.equal(getHistoricBatchIssueAdvice("SEM_NOTAS_HISTORICAS").title, "Pauta sem notas");
  assert.equal(getHistoricBatchIssueAdvice("ORIGEM_HISTORICA_INCOMPATIVEL").title,
    "Matrícula de origem por rever");
  assert.equal(getHistoricBatchIssueAdvice("RAA_RESULTADO_NAO_RECONHECIDO").title,
    "Resultado académico por rever");
});

test("unknown database reasons do not expose raw SQL errors to directors", () => {
  const message = getHistoricBatchIssueAdvice("SQLSTATE 23514 internal record");
  assert.equal(message.title, "Falha técnica de validação");
  assert.equal(isHistoricBatchAcademicIssue("SQLSTATE 23514 internal record"), false);
  assert.equal(isHistoricBatchAcademicIssue("RAA_RESULTADO_NAO_RECONHECIDO"), true);
  assert.doesNotMatch(message.nextStep, /SQLSTATE|23514/);
});
