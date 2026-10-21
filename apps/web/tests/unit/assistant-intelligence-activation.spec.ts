import test from "node:test";
import assert from "node:assert/strict";
import { INTELLIGENCE_INTENTS } from "../../src/lib/assistant/data-copilot/school-intelligence-contract";
import { INTELLIGENCE_FLAG_NAMES, isIntelligenceActive, disabledIntelligenceReason } from "../../src/lib/assistant/data-copilot/intelligence-activation";

test("cada uma das dez ferramentas tem uma flag distinta, desligada por padrão", () => {
  assert.equal(new Set(Object.values(INTELLIGENCE_FLAG_NAMES)).size, 10);
  for (const intent of INTELLIGENCE_INTENTS) {
    assert.equal(isIntelligenceActive(intent, {}), false);
    assert.match(disabledIntelligenceReason(intent, {}) ?? "", /desativada por segurança/);
  }
});

test("uma flag isolada não ignora a prova independente de fonte e isolamento", () => {
  for (const intent of INTELLIGENCE_INTENTS) {
    const key = INTELLIGENCE_FLAG_NAMES[intent];
    assert.equal(isIntelligenceActive(intent, { [key]: "true" }), false);
    assert.equal(isIntelligenceActive(intent, { [key]: "true", [`${key}_SOURCE_PROVEN`]: "true" }), false);
    assert.equal(isIntelligenceActive(intent, { [key]: "true", [`${key}_ISOLATION_PROVEN`]: "true" }), false);
    assert.equal(isIntelligenceActive(intent, { [key]: "false", [`${key}_SOURCE_PROVEN`]: "true", [`${key}_ISOLATION_PROVEN`]: "true" }), false);
    assert.equal(isIntelligenceActive(intent, { [key]: "true", [`${key}_SOURCE_PROVEN`]: "true", [`${key}_ISOLATION_PROVEN`]: "true" }), true);
  }
});

import { verifyTeacherAssignmentCoverage } from "../../src/lib/assistant/data-copilot/school-intelligence-contract";

test("denominador usa atribuições canónicas distintas, não linhas de pendências", () => {
  const a = { professor_id: "docente-1", turma_id: "turma-A", disciplina_id: "mat" };
  const b = { professor_id: "docente-1", turma_id: "turma-B", disciplina_id: "mat" };
  const c = { professor_id: "docente-2", turma_id: "turma-A", disciplina_id: "fis" };
  const row = (assignment: typeof a) => ({ ...assignment, trimestre: 1, tipo: "prova", avaliacao_id: "avaliacao", total_alunos: 20, notas_lancadas: 0, pendentes: 20 });
  const valid = verifyTeacherAssignmentCoverage([a, b, c], [row(a), row(b), row(c), row(a)]);
  assert.equal(valid.denominator, 2);
  assert.equal(valid.assignments, 3);
  assert.equal(valid.verified, true);
  assert.equal(verifyTeacherAssignmentCoverage([a, b, c], [row(a)]).verified, false);
  assert.equal(verifyTeacherAssignmentCoverage([a], [row(a), row(b)]).verified, false);
  assert.equal(verifyTeacherAssignmentCoverage([], []).verified, false);
});
