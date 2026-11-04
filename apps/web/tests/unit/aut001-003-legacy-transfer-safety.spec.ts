import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const sql = readFileSync(resolve(root, "supabase/migrations/20271031004000_disable_legacy_transferir_matricula.sql"), "utf8");
const installed = readFileSync(resolve(root, "supabase/migrations/20271031003000_bulk_turma_transfer_atomic.sql"), "utf8");
const audit = readFileSync(resolve(root, "supabase/ops/tests/aut001_003_transfer_integrity_readonly.sql"), "utf8");

test("AUT-001 disables unsafe duplicate-enrollment legacy RPC without changing data", () => {
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.transferir_matricula\(uuid,uuid,uuid\)/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /\b(UPDATE|INSERT INTO|DELETE FROM)\s+public\.(matriculas|notas|frequencias)/i);
  assert.match(sql, /has_function_privilege\('authenticated'/);
});
test("AUT-002 existing-grade transfers fail closed in individual and bulk paths", () => {
  assert.match(installed, /ERRCODE = 'P1050'/);
  assert.match(installed, /CREATE TRIGGER trg_guard_turma_transfer_academic_evidence/);
  assert.match(installed, /FOR SHARE/);
  assert.match(installed, /FOR UPDATE/);
  assert.match(installed, /REVOKE ALL ON FUNCTION public\.transferir_turma_em_lote/);
});
test("AUT-003 production audit cannot mutate historical student data", () => {
  assert.match(audit, /BEGIN READ ONLY/);
  assert.match(audit, /ROLLBACK/);
  assert.match(audit, /notes_bad|v_notes_bad/);
  assert.match(audit, /v_tenant_bad/);
  assert.match(audit, /v_exams_bad/);
  assert.match(audit, /v_attendance_bad/);
});
