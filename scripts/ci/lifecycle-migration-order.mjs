import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const dir = join(root, "supabase/migrations");
const finalName = "20271029100000_lifecycle_reconciliation_evidence_guards.sql";
const migrations = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
assert.ok(migrations.includes(finalName), "Lifecycle SSOT consolidation migration missing");
const prerequisites = [
  "20261204110000_historico_snapshot_lock_and_reopen_policy.sql",
  "20261215010000_canonicalize_matricula_status_ativo.sql",
  "20271022142000_cc003_canonical_polo_rls.sql",
  "20271027120000_lifecycle_ssot_post_replay_guard.sql",
];
for (const required of prerequisites) {
  assert.ok(migrations.includes(required), "Missing SSOT prerequisite: " + required);
  assert.ok(required < finalName, "SSOT prerequisite must precede final migration: " + required);
}
// Future migrations are permitted, but cannot silently overwrite the
// stabilized lifecycle RPCs, SSOT view, or role policies.
const protectedWriters = /(?:CREATE\s+OR\s+REPLACE\s+(?:FUNCTION|VIEW)\s+public\.(?:gradeengine_calcular_situacao|finalizar_origem_academica|ratificar_resultado_historico_escola|lifecycle_validate_historico_legal_lock|finalizar_matricula_blindada|gerar_historico_anual|sync_historico_anos_compat|lifecycle_sync_matricula_ativo|activate_aluno_after_matricula|v_student_lifecycle_ssot_v1)\b|(?:DROP|CREATE)\s+POLICY\s+lifecycle_matriculas_)/i;
for (const migration of migrations.filter((file) => file > finalName)) {
  const source = readFileSync(join(dir, migration), "utf8");
  assert.ok(!protectedWriters.test(source),
    migration + " changes SSOT writers or policies after stabilization; update lifecycle contract first");
}
const archives = readdirSync(join(root, "supabase/ops/applied_lifecycle_20261028"))
  .filter((f) => /^20261028.*\.sql$/.test(f));
assert.equal(archives.length, 11, "11 original installed lifecycle migrations must remain archived");
for (const file of archives) {
  const shim = readFileSync(join(dir, file), "utf8");
  assert.match(shim, /SELECT 1 WHERE false;/, file + " must defer until late replay");
}
const content = readFileSync(join(dir, finalName), "utf8");
const oldRebuild = readFileSync(join(dir, "20271027120000_lifecycle_ssot_post_replay_guard.sql"),"utf8");
assert.match(oldRebuild,/security_invoker=true/,"Original SSOT rebuild must remain stable");
const remoteArchive = readdirSync(join(root, "supabase/ops/applied_lifecycle_20261029"))
  .filter((f) => /^20261029.*\.sql$/.test(f));
assert.equal(remoteArchive.length,3,"Three installed 2026-10-29 academic-only fixes must be archived");
for (const file of remoteArchive) {
  const shim = readFileSync(join(dir, file),"utf8");
  assert.match(shim,/SELECT 1 WHERE false;/,"Installed academic fix must defer to late replay: " + file);
}
for (const token of [
  "gradeengine_calcular_situacao","v_official_rows = 0",
  "finalizar_origem_academica","ratificar_resultado_historico_escola",
  "trg_lifecycle_guard_official_history_lock", "ACADEMIC_DECISION_EVIDENCE_REQUIRED"
]) {
  assert.ok(content.includes(token), "missing final lifecycle guard " + token);
}
console.log("Lifecycle migration replay ordering and integrity contract OK");
