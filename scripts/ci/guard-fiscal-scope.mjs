/**
 * Guard only the scope of receipt/enrollment PRs.
 *
 * Audited lifecycle migrations are allowed, but fiscal/AGT/SAF-T activation
 * remains prohibited. Do not turn this into a blanket migration exception.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LIFECYCLE_MIGRATION_ALLOWLIST = new Set([
  "20261028211345_lifecycle_p0_revoke_legacy_writers_20261028.sql",
  "20261028211433_lifecycle_sync_status_ativo_20261028.sql",
  "20261028211533_lifecycle_history_ssot_view_20261028.sql",
  "20261028211752_lifecycle_fix_historico_session_and_final_gate_20261028.sql",
  "20261028211809_lifecycle_finalizar_blindada_result_authority_20261028.sql",
  "20261028212124_lifecycle_reconcile_unique_historical_link_20261028.sql",
  "20261028212242_lifecycle_matriculas_staff_write_rls_20261028.sql",
  "20261028212343_lifecycle_ssot_view_private_scope_20261028.sql",
  "20261028212414_lifecycle_ssot_view_dba_scope_20261028.sql",
  "20261028212425_lifecycle_aluno_activation_canonical_trigger_20261028.sql",
  "20261028214241_lifecycle_restrict_matricula_write_roles_20261028.sql",
  "20271027120000_lifecycle_ssot_post_replay_guard.sql",
]);

const FISCAL_PATH = /^(?:apps\/web\/src\/(?:app\/api\/(?:fiscal|agt)\/|lib\/(?:server\/)?(?:fiscal|agt)(?:\/|\.|$))|supabase\/(?:functions\/[^/]*(?:fiscal|agt|saft)|migrations\/[^/]*(?:fiscal|agt|saft)))/i;
// Prevent fiscal activation hidden inside an allowlisted academic migration.
// Ordinary references to finance/payment are not fiscal engine activation.
const FISCAL_SQL = /\b(?:AGT|SAF[-_]?T|SAFT|fiscal(?:iza(?:c|ç)[aã]o)?|fatur(?:a(?:ç|c)[aã]o|as?)|factur(?:a(?:ç|c)[aã]o|as?))\b/i;

export function checkFiscalAndSchemaScope(paths, readMigration = (path) => readFileSync(path, "utf8")) {
  const violations = [];
  for (const path of paths) {
    if (!path) continue;
    if (FISCAL_PATH.test(path)) {
      violations.push(`Fiscal/AGT module change prohibited: ${path}`);
      continue;
    }
    if (!path.startsWith("supabase/migrations/")) continue;

    const name = path.slice("supabase/migrations/".length);
    if (!LIFECYCLE_MIGRATION_ALLOWLIST.has(name)) {
      violations.push(`Unapproved database migration in this workflow: ${path}`);
      continue;
    }

    const content = readMigration(path);
    if (FISCAL_SQL.test(content)) {
      violations.push(`Fiscal/AGT activation marker in lifecycle migration: ${path}`);
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base || !/^origin\/[\w./-]+$/.test(base)) {
    console.error("Usage: node scripts/ci/guard-fiscal-scope.mjs origin/main");
    process.exit(2);
  }
  const changed = execFileSync("git", ["diff", "--name-only", "-z", `${base}...HEAD`], {
    encoding: "utf8",
  }).split("\0").filter(Boolean);
  const errors = checkFiscalAndSchemaScope(changed);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("Fiscal/AGT/SAF-T unchanged; only approved lifecycle SSOT migrations allowed.");
}
