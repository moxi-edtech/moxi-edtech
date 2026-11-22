import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const sql = read("../../../../supabase/migrations/20271201110000_raa_activation_guard_reconciled.sql");
const hook = read("../../src/hooks/useRematriculaBalcao.ts");
const modal = read("../../src/components/secretaria/RematriculaBalcaoModal.tsx");
const workflow = read("../../../../.github/workflows/raa-activation-guard-reconciled-pg17.yml");

test("reconciled activation guard reuses canonical RAA with exact prior pupil and tenant", () => {
  assert.match(sql, /RAA_ACTIVATION_DEPENDENCY_DRIFT/);
  assert.match(sql, /RAA_ACTIVATION_TRIGGER_ALREADY_EXISTS/);
  assert.match(sql, /NEW\.origem_transicao_matricula_id/);
  assert.match(sql, /m\.aluno_id=NEW\.aluno_id/);
  assert.match(sql, /v_origin\.ano_letivo/);
  assert.match(sql, /public\.resolve_raa_progression_for_matricula\(/);
  assert.match(sql, /v_decision='concluiu'/);
  assert.match(sql, /v_decision='retido'/);
  assert.match(sql, /v_decision='transitou'/);
  assert.match(sql, /CREATE TRIGGER trg_klasse_guard_enrollment_raa_progression/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.guard_enrollment_raa_progression_v1\(\)/);
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(?:notas|matriculas|historico_anos|historico_disciplinas|pagamentos)/i);
});

test("real PG17 fixture covers legal ratification and no fixture persists", () => {
  assert.match(workflow, /enrollment_guard_activation_regression\.sql/);
  assert.match(workflow, /enrollment_guard_real_raa_regression\.sql/);
  assert.match(workflow, /test "\$\(psql -X -Atc 'select count\(\*\) from public\.matriculas'\)" = "0"/);
});

test("school sees actual RAA reason but retains low-friction Balcao wizard behavior", () => {
  for (const src of [hook, modal]) {
    assert.match(src, /ENROLLMENT_RAA_DECISION_REQUIRED:/);
    assert.match(src, /ENROLLMENT_RAA_CONFIRMATION_BLOCKED:/);
    assert.match(src, /ENROLLMENT_RAA_DESTINATION_MISMATCH:/);
  }
  assert.match(hook, /RECONFIRMATION_REQUIRED/);
  assert.match(hook, /setSelectedTurmaId/);
  assert.match(modal, /minStep/);
});
