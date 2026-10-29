/**
 * Guard only the scope of receipt/enrollment PRs.
 *
 * Audited lifecycle, RAA and MED migrations are allowed, but fiscal/AGT/SAF-T activation
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
  "20261029090749_lifecycle_gradeengine_missing_evidence_fail_closed_20261029.sql",
  "20261029091406_lifecycle_academic_decisions_and_legal_lock_guard_20261029.sql",
  "20261029091637_lifecycle_historical_outcomes_ratification_20261029.sql",
  "20271029100000_lifecycle_reconciliation_evidence_guards.sql",
  // Three migrations applied live plus the three full late replay migrations.
  // Allow each exact audited academic file, never arbitrary database changes.
  "20261029102650_curtume_class_metadata_and_transition_lineage_20261029.sql",
  "20261029103216_curtume_legal_history_destination_guard_20261029.sql",
  "20261029103555_curtume_turma_classe_number_consistency_20261029.sql",
  "20271029110000_curtume_class_metadata_and_transition_lineage.sql",
  "20271029120000_curtume_legal_history_destination_guard.sql",
  "20271029130000_curtume_turma_classe_number_consistency.sql",
  "20271029140000_global_academic_class_metadata_contract.sql",
  "20261029110413_global_academic_class_metadata_contract_20261029.sql",
  "20261029112728_enrollment_context_atomic_authorized_create_20261029.sql",
  "20271029150000_enrollment_context_atomic_authorized_create.sql",
  "20261029113302_enrollment_view_academic_year_ssot_20261029.sql",
  "20271029151000_enrollment_view_academic_year_ssot.sql",
  // Read-only contextual lifecycle projection; no student, grade, or finance writes.
  "20271029235900_lifecycle_contextual_status_ssot_v2.sql",
  // Live-applied, no-op migration ledger shims; full late replay remains gated.
  "20261029132302_lifecycle_contextual_status_ssot_v2.sql",
  "20261029132512_lifecycle_contextual_status_v2_select_only.sql",
  "20271029235910_lifecycle_persisted_status_contract_v3.sql",
  // PR #298: individually audited RAA permissions, grade-period protection
  // and canonical MED school/calendar schemas. The fiscal/AGT/SAF-T scanner
  // below still examines executable SQL in every allowlisted migration.
  "20271029235920_raa_balcao_authoritative_permissions.sql",
  "20271029235921_guard_grade_period_source_and_window.sql",
  "20271029235922_canonical_med_calendar_offering_profiles.sql",
  "20271029235923_apply_canonical_med_calendar_atomic.sql",
]);

const FISCAL_PATH = /^(?:apps\/web\/src\/(?:app\/api\/(?:fiscal|agt)(?:\/|\.|-|$)|lib\/(?:server\/)?(?:fiscal|agt)(?:\/|\.|-|$))|supabase\/(?:functions\/[^/]*(?:fiscal|agt|saft)|migrations\/[^/]*(?:fiscal|agt|saft)))/i;
// Prevent fiscal activation hidden inside an allowlisted academic migration.
// Ordinary references to finance/payment are not fiscal engine activation.
const FISCAL_SQL = /\b(?:AGT|SAF[-_]?T|SAFT|fiscal(?:iza(?:c|ç)[aã]o)?|fatur(?:a(?:ç|c)[aã]o|as?)|factur(?:a(?:ç|c)[aã]o|as?))(?=[^a-z0-9]|$)/i;

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
    // Comments are documentation, not executable SQL.
    // Scan executable SQL to prevent hidden fiscal activation.
    const executableSql = content.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (FISCAL_SQL.test(executableSql)) {
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
  console.log("Fiscal/AGT/SAF-T unchanged; only explicitly audited academic migrations allowed.");
}
