import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { disabledIntelligenceReason, isIntelligenceActive } from "../../src/lib/assistant/data-copilot/intelligence-activation";
import { classifySchoolQuestion } from "../../src/lib/assistant/data-copilot/school-intelligence-contract";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, "../../src/lib/assistant/data-copilot/tools/school-intelligence.ts"), "utf8");
const canonical = fs.readFileSync(path.join(directory, "../../src/lib/academico/raa-progression-server.ts"), "utf8");

test("RAA uses the same official resolver as the Secretaria endpoint, not a heuristic", () => {
  const section = source.slice(source.indexOf("async function officialRaaStatusByTurma("));
  assert.match(section, /resolveRaaProgressionForMatricula\(supabase, schoolId/);
  assert.match(canonical, /"resolve_raa_progression_for_matricula"/);
  assert.match(canonical, /resolveDecretoDecision/);
  assert.doesNotMatch(section, /risk_score|vw_risco_pedagogico_aluno|service_role|supabaseAdmin|createClient\(/);
  assert.match(section, /\.eq\("escola_id", schoolId\)/);
  assert.match(section, /\.eq\("session_id", year\.id\)/);
  assert.match(section, /\.limit\(MAX_RAA_ENROLLMENTS\)/);
  assert.match(section, /summarizeOfficialRaaByTurma\(enrollments, decisions\)/);
});

test("RAA official status not available without source/isolation proof even when flag is set", () => {
  assert.equal(isIntelligenceActive("official_failure_risk", {}), false);
  assert.match(disabledIntelligenceReason("official_failure_risk", {}) ?? "", /isolamento/);
  assert.equal(isIntelligenceActive("official_failure_risk", {
    KLASSE_AI_OFFICIAL_FAILURE_RISK: "true", KLASSE_AI_OFFICIAL_FAILURE_RISK_SOURCE_PROVEN: "true",
  }), false);
});

test("golden alternative RAA questions map to the official risk intent", () => {
  for (const utterance of [
    "Quais turmas têm risco de reprovação?",
    "Que turmas têm mais alunos retidos pelo RAA?",
    "Mostra o estado RAA de reprovação por turma",
    "Quais turmas têm alunos com risco de retenção?",
    "Quantos alunos por turma estão em reprovação?",
  ]) {
    assert.equal(classifySchoolQuestion(utterance), "official_failure_risk", utterance);
  }
});
