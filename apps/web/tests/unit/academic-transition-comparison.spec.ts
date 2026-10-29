import test from "node:test";
import assert from "node:assert/strict";
import { compareNextYearEnrollment, confirmedOutcomeFitsDestination } from "../../src/lib/rematricula/compare-next-year-enrollment";

const origin = "00000000-0000-4000-8000-000000000001";
const previous = { numero: null, nome: "7ª Classe" };

test("detects missing lineage without assuming a result", () => {
  const result = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: previous,
    destino: { origem_transicao_matricula_id: null, classe: { nome: "8ª Classe", numero: 8 } },
  });
  assert.deepEqual(result.alertas, ["DESTINO_SEM_VINCULO"]);
  assert.equal(result.delta, 1);
});
test("detects irregular promotions and regression, never synthesizing notes", () => {
  const skip = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: previous,
    destino: { origem_transicao_matricula_id: origin, classe: { nome: "9ª Classe", numero: 9 } },
  });
  assert.deepEqual(skip.alertas, ["SALTO_DE_CLASSE"]);
  assert.equal(confirmedOutcomeFitsDestination("aprovado", skip, true), false);
  const back = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: { numero: 3, nome: "3ª Classe" },
    destino: { origem_transicao_matricula_id: origin, classe: { nome: "2ª Classe", numero: 2 } },
  });
  assert.deepEqual(back.alertas, ["REGRESSAO_DE_CLASSE"]);
});
test("repeating a grade requires confirmation, not an automatic negative grade", () => {
  const repeat = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: previous,
    destino: { origem_transicao_matricula_id: origin, classe: { numero: 7, nome: "7ª Classe" } },
  });
  assert.deepEqual(repeat.alertas, ["REPETICAO_A_CONFIRMAR"]);
  assert.equal(confirmedOutcomeFitsDestination("reprovado", repeat, true), true);
  assert.equal(confirmedOutcomeFitsDestination("aprovado", repeat, true), false);
});
test("preschool progresses to first grade; absent destinations cannot prove a decision", () => {
  const promoted = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: { numero: null, nome: "Pré-Escolar" },
    destino: { origem_transicao_matricula_id: origin, classe: { numero: 1, nome: "1ª Classe" } },
  });
  assert.equal(promoted.delta, 1);
  assert.deepEqual(promoted.alertas, []);
  assert.equal(confirmedOutcomeFitsDestination("aprovado", promoted, true), true);
  const missing = compareNextYearEnrollment({ matriculaOrigemId: origin, classeOrigem: previous });
  assert.deepEqual(missing.alertas, []);
  assert.equal(missing.delta, null);
  assert.equal(confirmedOutcomeFitsDestination("concluido", missing, false), true);
});
test("ambiguous names and different linked matriculas fail closed", () => {
  const problem = compareNextYearEnrollment({
    matriculaOrigemId: origin, classeOrigem: previous,
    destino: { origem_transicao_matricula_id: "wrong", classe: { numero: null, nome: "Curso X" } },
  });
  assert.deepEqual(problem.alertas, ["VINCULO_DIVERGENTE", "CLASSE_NAO_IDENTIFICADA"]);
  assert.equal(confirmedOutcomeFitsDestination("aprovado", problem, true), false);
});
