import test from "node:test";
import assert from "node:assert/strict";
import { checkFiscalAndSchemaScope, LIFECYCLE_MIGRATION_ALLOWLIST } from "../guard-fiscal-scope.mjs";

const firstLifecycle = "supabase/migrations/20261028211433_lifecycle_sync_status_ativo_20261028.sql";
const finalLifecycle = "supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql";

test("allows only the 12 reviewed enrollment/historical SQL migrations", () => {
  assert.equal(LIFECYCLE_MIGRATION_ALLOWLIST.size, 12);
  assert.deepEqual(checkFiscalAndSchemaScope([firstLifecycle, finalLifecycle], () => "CREATE VIEW enrollment AS SELECT 1;"), []);
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
