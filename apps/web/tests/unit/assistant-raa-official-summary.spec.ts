import test from "node:test";
import assert from "node:assert/strict";
import { summarizeOfficialRaaByTurma } from "../../src/lib/assistant/data-copilot/raa-official-summary";
import type { RaaEnrollmentDecision } from "../../src/lib/assistant/data-copilot/raa-official-summary";

const students: Array<{ matriculaId: string; alunoId: string; turmaId: string }> = [
  { matriculaId: "m1", alunoId: "a1", turmaId: "t1" },
  { matriculaId: "m2", alunoId: "a2", turmaId: "t1" },
  { matriculaId: "m3", alunoId: "a3", turmaId: "t2" },
  { matriculaId: "m4", alunoId: "a4", turmaId: "t2" },
  { matriculaId: "m5", alunoId: "a5", turmaId: "t2" },
];
const decided: RaaEnrollmentDecision[] = [
  { ...students[0], decision: "retido" },
  { ...students[1], decision: "pendente" },
  { ...students[2], decision: "retido_por_faltas" },
  { ...students[3], decision: "recurso" },
  { ...students[4], decision: "concluiu" },
];

test("agrupa decisões RAA oficiais por turma sem heurística de previsão", () => {
  const result = summarizeOfficialRaaByTurma(students, decided);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.source, "resolveRaaProgressionForMatricula");
  assert.deepEqual(result.classes.map(({ turmaId, total, retenidos, pendentes, emRecurso }) =>
    ({ turmaId, total, retenidos, pendentes, emRecurso })), [
    { turmaId: "t1", total: 2, retenidos: 1, pendentes: 1, emRecurso: 0 },
    { turmaId: "t2", total: 3, retenidos: 1, pendentes: 0, emRecurso: 1 },
  ]);
  assert.equal(result.classes[1].retidosPorFaltas, 1);
});

test("decisões pendentes, recurso e inscrição condicional não são reprovação", () => {
  const input = students.slice(0, 3);
  const result = summarizeOfficialRaaByTurma(input, [
    { ...input[0], decision: "pendente" },
    { ...input[1], decision: "recurso" },
    { ...input[2], decision: "inscricao_condicional" },
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.classes.reduce((sum, item) => sum + item.retenidos, 0), 0);
  assert.equal(result.classes.reduce((sum, item) => sum + item.inscricaoCondicional, 0), 1);
});

test("recusa a menor falta de cobertura de matrículas e duplicações", () => {
  assert.equal(summarizeOfficialRaaByTurma([], []).ok, false);
  assert.equal(summarizeOfficialRaaByTurma(students, decided.slice(0, -1)).ok, false);
  assert.equal(summarizeOfficialRaaByTurma(students, [...decided.slice(0, -1), decided[0]]).ok, false);
  assert.equal(summarizeOfficialRaaByTurma(students, [...decided.slice(0, -1), { ...decided[4], turmaId: "t1" }]).ok, false);
  assert.equal(summarizeOfficialRaaByTurma([...students, { ...students[0], matriculaId: "m6" }], decided).ok, false);
  assert.equal(summarizeOfficialRaaByTurma(students, [...decided.slice(0, -1), { ...decided[4], decision: "previsto_reprovado" as RaaEnrollmentDecision["decision"] }]).ok, false);
});
