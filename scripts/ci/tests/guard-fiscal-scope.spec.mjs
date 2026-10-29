import test from "node:test";
import assert from "node:assert/strict";
import { checkFiscalAndSchemaScope, LIFECYCLE_MIGRATION_ALLOWLIST } from "../guard-fiscal-scope.mjs";

const firstLifecycle = "supabase/migrations/20261028211433_lifecycle_sync_status_ativo_20261028.sql";
const finalLifecycle = "supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql";

test("allows only audited enrollment and historical evidence migrations", () => {
  assert.equal(LIFECYCLE_MIGRATION_ALLOWLIST.size, 28);
  assert.deepEqual(checkFiscalAndSchemaScope([firstLifecycle, finalLifecycle], () => "CREATE VIEW enrollment AS SELECT 1;"), []);
});

test("allows precisely the six audited Curtume academic migrations", () => {
  const migrations = [
    "20261029102650_curtume_class_metadata_and_transition_lineage_20261029.sql",
    "20261029103216_curtume_legal_history_destination_guard_20261029.sql",
    "20261029103555_curtume_turma_classe_number_consistency_20261029.sql",
    "20271029110000_curtume_class_metadata_and_transition_lineage.sql",
    "20271029120000_curtume_legal_history_destination_guard.sql",
    "20271029130000_curtume_turma_classe_number_consistency.sql",
  ].map((name) => "supabase/migrations/" + name);
  for (const path of migrations) {
    assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
      "CREATE TRIGGER academic_integrity BEFORE UPDATE ON matriculas EXECUTE FUNCTION guard_integrity();"), [], path);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.fiscal_integrations (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
  assert.match(checkFiscalAndSchemaScope([
    "supabase/migrations/20271029130001_curtume_unreviewed.sql",
  ])[0] ?? "", /Unapproved database migration/);
});

test("global academic class metadata guard is allowlisted without fiscal exceptions", () => {
  const path = "supabase/migrations/20271029140000_global_academic_class_metadata_contract.sql";
  assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
    "CREATE TRIGGER trg_class_guard BEFORE INSERT ON classes EXECUTE FUNCTION class_guard();"), []);
  assert.match(checkFiscalAndSchemaScope([path], () =>
    "ALTER TABLE public.fiscal_config ADD COLUMN enabled boolean;")[0] ?? "", /Fiscal\/AGT activation/);
});

test("new atomic enrollment and live ledger markers stay within audited scope", () => {
  for (const path of [
    "20261029112728_enrollment_context_atomic_authorized_create_20261029.sql",
    "20271029150000_enrollment_context_atomic_authorized_create.sql",
  ]) {
    const name = "supabase/migrations/" + path;
    assert.deepEqual(checkFiscalAndSchemaScope([name], () =>
      "CREATE TRIGGER enrollment_guard BEFORE INSERT ON matriculas EXECUTE FUNCTION check_year();"), []);
    assert.match(checkFiscalAndSchemaScope([name], () =>
      "CREATE TABLE public.agt_integrations (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("read-only enrollment view migration is allowlisted without changing fiscal contracts", () => {
  for (const name of [
    "20261029113302_enrollment_view_academic_year_ssot_20261029.sql",
    "20271029151000_enrollment_view_academic_year_ssot.sql",
  ]) {
    const path = "supabase/migrations/" + name;
    assert.deepEqual(checkFiscalAndSchemaScope([path], () =>
      "CREATE OR REPLACE VIEW vw_matriculas_validas AS SELECT session_id AS ano_letivo_id FROM matriculas;"), []);
    assert.match(checkFiscalAndSchemaScope([path], () =>
      "CREATE TABLE public.saft_export (id uuid);")[0] ?? "", /Fiscal\/AGT activation/);
  }
});

test("preserves the fiscal and AGT module freeze", () => {
  for (const path of [
    "apps/web/src/app/api/fiscal/activate/route.ts",
    "apps/web/src/app/api/agt/invoices/route.ts",
    "apps/web/src/lib/server/fiscal-engine.ts",
    "apps/web/src/lib/fiscal/processor.ts",
    "supabase/functions/agt-bridge/index.ts",
    "supabase/migrations/20261029000000_agt_saf_t.sql",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([path]).length > 0, `must reject ${path}`);
  }
});

test("rejects unexpected database migrations without weakening the guard", () => {
  const path = "supabase/migrations/20261029000000_other_database_change.sql";
  assert.match(checkFiscalAndSchemaScope([path])[0], /Unapproved database migration/);
});

test("rejects fiscal, SAF-T or AGT activation content inside an allowlisted migration", () => {
  for (const activation of [
    "CREATE TABLE public.fiscal_config (id uuid);",
    "CREATE TABLE public.agt_integrations (id uuid);",
    "CREATE TABLE public.saft_receipts (id uuid);",
    "ALTER TABLE public.faturas ADD COLUMN enabled boolean;",
  ]) {
    assert.ok(checkFiscalAndSchemaScope([finalLifecycle], () => activation).length > 0, activation);
  }
});

test("does not conflate ordinary payment or RAA operations with fiscal activation", () => {
  assert.deepEqual(checkFiscalAndSchemaScope([
    "apps/web/src/lib/financeiro/recover-receipt-after-payment.ts",
    firstLifecycle,
  ], () => "UPDATE matriculas SET ativo = true WHERE status = 'ativo';"), []);
});

test("allows documentary comments but blocks actual fiscal activation SQL", () => {
  const migration = "supabase/migrations/20271029100000_lifecycle_reconciliation_evidence_guards.sql";
  assert.deepEqual(checkFiscalAndSchemaScope([migration], () => "-- Fiscal functions unchanged\nCREATE VIEW academic_history AS SELECT 1;"), []);
  assert.ok(checkFiscalAndSchemaScope([migration], () => "-- academic reconciliation\nCREATE TABLE public.fiscal_documentos (id uuid);").length > 0);
});
