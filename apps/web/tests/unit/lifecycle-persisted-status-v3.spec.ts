import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../../../../supabase/migrations/20271029235910_lifecycle_persisted_status_contract_v3.sql", import.meta.url), "utf8");
test("persisted matrícula has exactly eight distinct administrative states", () => {
  assert.match(migration, /CHECK \(status IN \('rascunho','pendente','ativo','concluido','transferido','anulado','trancado','desistente'\)\)/);
  assert.match(migration, /ACADEMIC_RESULT_NOT_ENROLLMENT_STATUS/);
  assert.match(migration, /MATRICULA_STATUS_INVALID/);
  assert.match(migration, /LEGACY_STATUS_ROWS_REQUIRE_RECONCILIATION/);
});
test("GradeEngine finalization always stores concluido and independent academic outcome", () => {
  assert.match(migration, /v_status_calculado := 'concluido'/);
  assert.match(migration, /v_status := 'concluido'/);
  assert.match(migration, /SET resultado_final = CASE WHEN v_grade->>'situacao_final'='reprovado_por_faltas'/);
  assert.match(migration, /THEN 'reprovado' ELSE v_grade->>'situacao_final' END/);
  assert.match(migration, /'motivos_academicos'/);
  assert.match(migration, /WHEN boletim_row.nota_final IS NULL THEN NULL/);
  assert.match(migration, /ACADEMIC_RESULT_CONFLICT/);
  assert.match(migration, /resultado_academico/);
});
test("legal lock verifies actual historic decision, not administrative reprovado", () => {
  assert.match(migration, /v_matricula.status IS DISTINCT FROM 'concluido'/);
  assert.match(migration, /v_historico.resultado_final NOT IN \('aprovado','reprovado','concluido'\)/);
  assert.match(migration, /ACADEMIC_DECISION_EVIDENCE_REQUIRED/);
});
test("RAA, rematricula and import keep verified results in historico_anos", () => {
  assert.match(migration, /v_decision IN \('transitou','retido'\)/);
  assert.match(migration, /finalizar_origem_academica/);
  assert.match(migration, /v_resultado_academico/);
  assert.match(migration, /resultado_oficial='aprovado'/);
  assert.doesNotMatch(migration, /SET status = CASE WHEN v_retido THEN 'reprovado'/);
});
test("legacy finalization delegates to the canonical writer; API has no failed-status override", () => {
  assert.match(migration, /LIFECYCLE_CANONICAL_FLOW_REQUIRED/);
  assert.match(migration, /finalizar_matricula_blindada\(p_escola_id,p_matricula_id,p_motivo,false,NULL\)/);
  const route = readFileSync(new URL("../../src/app/api/secretaria/matriculas/[matriculaId]/finalizar/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /REPROVADO_POR_FALTAS/);
});
