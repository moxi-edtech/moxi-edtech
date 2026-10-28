import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const dir = join(root, "supabase/migrations");
const finalName = "20271027120000_lifecycle_ssot_post_replay_guard.sql";
const migrations = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
assert.ok(migrations.includes(finalName), "Lifecycle SSOT consolidation migration missing");
const prerequisites = [
  "20261204110000_historico_snapshot_lock_and_reopen_policy.sql",
  "20261215010000_canonicalize_matricula_status_ativo.sql",
  "20271022142000_cc003_canonical_polo_rls.sql",
];
for (const required of prerequisites) {
  assert.ok(migrations.includes(required), "Missing SSOT prerequisite: " + required);
  assert.ok(required < finalName, "SSOT prerequisite must precede final migration: " + required);
}
// Future migrations are permitted, but cannot silently overwrite the
// stabilized lifecycle RPCs, SSOT view, or role policies.
const protectedWriters = /(?:CREATE\s+OR\s+REPLACE\s+(?:FUNCTION|VIEW)\s+public\.(?:finalizar_matricula_blindada|gerar_historico_anual|sync_historico_anos_compat|lifecycle_sync_matricula_ativo|activate_aluno_after_matricula|v_student_lifecycle_ssot_v1)\b|(?:DROP|CREATE)\s+POLICY\s+lifecycle_matriculas_)/i;
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
for (const token of ["security_invoker=true", "CREATE POLICY lifecycle_matriculas_update_staff",
  "ALTER TABLE public.matriculas", "CREATE OR REPLACE VIEW public.v_student_lifecycle_ssot_v1",
  "REVOKE EXECUTE ON FUNCTION public.confirmar_matricula_core"]) {
  assert.ok(content.includes(token), "missing final lifecycle guard " + token);
}
console.log("Lifecycle migration replay ordering and integrity contract OK");
