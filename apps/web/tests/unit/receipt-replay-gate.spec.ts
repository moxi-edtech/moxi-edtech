import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.resolve(process.cwd(), "../../supabase/ops/scripts/replay_receipt_outbox_PROVEN_ONLY.sql"),
  "utf8"
);
test("receipt replay is read-only by default", () => {
  assert.match(source, /\\set run_write false/);
  assert.match(source, /\\if :run_write/);
  assert.match(source, /DRY_RUN_NO_CHANGE/);
});
test("write branch requires never-delivered proof and owner approval", () => {
  assert.match(source, /OWNER_APPROVED_RECEIPT_REPLAY/);
  assert.match(source, /NUNCA_ENTREGUE/);
  assert.match(source, /Receipt exists: cannot replay/);
  assert.match(source, /Recorded delivery: cannot replay/);
  assert.match(source, /already replayed before: blocked/);
});
test("replay is one-event only and saves a transaction-local backup", () => {
  assert.match(source, /WHERE id=candidate\.id/);
  assert.match(source, /original_row jsonb NOT NULL/);
  assert.match(source, /FOR UPDATE/);
});
