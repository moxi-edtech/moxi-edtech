import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const dir = join(root, "supabase/migrations");
const finalName = "20271027120000_lifecycle_ssot_post_replay_guard.sql";
const migrations = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
assert.equal(migrations.at(-1), finalName, "Lifecycle consolidation must be the final migration in lexical replay");
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
