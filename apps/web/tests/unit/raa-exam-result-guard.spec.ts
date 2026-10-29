import test from "node:test";
import assert from "node:assert/strict";
import { validateRaaExamResult, type ExamGuardInput } from "../../src/lib/academico/raa-exam-result-guard";

const good: ExamGuardInput = {
  source: { aluno_id: "a", turma_id: "t", session_id: "y", status: "ativo" },
  session: { id: "s", turma_id: "t", ano_letivo_id: "y", estado: "aberta" },
  turmaDisciplina: { turma_id: "t" },
  componente: { exame_sessao_id: "s", nota_max: 20 },
  alunoId: "a", nota: 10,
};
test("exame oficial contextual da turma e ano de origem pode ser lançado", () => {
  assert.equal(validateRaaExamResult(good), null);
  assert.equal(validateRaaExamResult({ ...good, session: { ...good.session!, turma_id: null } }), null);
});
test("troca de aluno, turma ou ano letivo bloqueia resultado", () => {
  assert.equal(validateRaaExamResult({ ...good, alunoId: "outro" }), "EXAM_SOURCE_MISMATCH");
  assert.equal(validateRaaExamResult({ ...good, session: { ...good.session!, turma_id: "outra" } }), "EXAM_SOURCE_MISMATCH");
  assert.equal(validateRaaExamResult({ ...good, session: { ...good.session!, ano_letivo_id: "outro" } }), "EXAM_YEAR_MISMATCH");
});
test("componente e disciplina são vinculados à matrícula de origem", () => {
  assert.equal(validateRaaExamResult({ ...good, turmaDisciplina: { turma_id: "outra" } }), "EXAM_DISCIPLINE_MISMATCH");
  assert.equal(validateRaaExamResult({ ...good, componente: { exame_sessao_id: "outra", nota_max: 20 } }), "EXAM_COMPONENT_MISMATCH");
});
test("fecho legal, sessão encerrada e notas fora da escala impedem gravação", () => {
  for (const status of ["concluido", "transferido", "anulado", "trancado", "desistente"]) {
    assert.equal(validateRaaExamResult({ ...good, source: { ...good.source!, status } }), "RAA_LEGAL_LOCK", status);
  }
  assert.equal(validateRaaExamResult({ ...good, session: { ...good.session!, estado: "encerrada" } }), "EXAM_SESSION_LOCKED");
  assert.equal(validateRaaExamResult({ ...good, nota: 21 }), "EXAM_NOTE_EXCEEDS_MAX");
  assert.equal(validateRaaExamResult({ ...good, nota: Number.NaN }), "EXAM_NOTE_EXCEEDS_MAX");
});
