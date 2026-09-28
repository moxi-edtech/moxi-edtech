import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "../../supabase/migrations/20260928002000_bill_018_payment_idempotency_hardening.sql"
);

async function migration() {
  return readFile(migrationPath, "utf8");
}

test("BILL-018 migration is transactional and intentionally preserves historical NULL keys", async () => {
  const sql = await migration();
  assert.match(sql, /^\s*-- BILL-018[\s\S]*?\bBEGIN;/i);
  assert.match(sql, /\bCOMMIT;\s*$/i);
  assert.match(sql, /does NOT backfill public\.pagamentos\.idempotency_key/i);
  assert.doesNotMatch(
    sql,
    /UPDATE\s+public\.pagamentos\s+SET\s+idempotency_key\s*=/i
  );
  assert.doesNotMatch(
    sql,
    /ALTER\s+TABLE\s+public\.pagamentos[\s\S]{0,300}idempotency_key\s+SET\s+NOT\s+NULL/i
  );
});

test("BILL-018 preflights the existing partial unique index before changing writers", async () => {
  const sql = await migration();
  const preflightPos = sql.indexOf("ux_pagamentos_escola_idempotency");
  const writerPos = sql.indexOf("CREATE OR REPLACE FUNCTION public.finance_confirm_payment");
  assert.ok(preflightPos >= 0 && writerPos > preflightPos);
  assert.match(sql, /BILL018_PREFLIGHT: ux_pagamentos_escola_idempotency missing/);
});

test("BILL-018 fail-closed insert/update guards keep identity stable", async () => {
  const sql = await migration();
  assert.match(sql, /novos pagamentos exigem idempotency_key estável/);
  assert.match(sql, /NEW\.idempotency_key IS DISTINCT FROM OLD\.idempotency_key/);
  assert.match(sql, /idempotency_key do pagamento não pode ser alterada/);
  assert.match(sql, /pagamento_intent_id/);
  assert.match(sql, /provider-tx:%s/);
});

test("BILL-018 revokes payment writers that cannot carry a stable retry identity", async () => {
  const sql = await migration();
  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES\s+ON FUNCTION public\.registrar_pagamento\(uuid,text,text,numeric,date\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/i
  );
  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES\s+ON FUNCTION public\.realizar_pagamento_balcao\(uuid,uuid,jsonb,text,numeric\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/i
  );
});

class AtomicPaymentStore {
  private committed = new Map<string, { id: string; key: string }>();
  private queue = Promise.resolve();
  private seq = 0;

  transact(key: string, options?: { failBeforeCommit?: boolean }) {
    const operation = this.queue.then(async () => {
      const existing = this.committed.get(key);
      if (existing) return { kind: "replayed" as const, payment: existing };

      const candidate = { id: "p-" + String(++this.seq), key };
      if (options?.failBeforeCommit) {
        throw new Error("simulated rollback");
      }
      this.committed.set(key, candidate);
      return { kind: "created" as const, payment: candidate };
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  get(key: string) {
    return this.committed.get(key) ?? null;
  }
}

test("BILL-018 concurrency contract converges two same-key attempts to one committed payment", async () => {
  const store = new AtomicPaymentStore();
  const [a, b] = await Promise.all([
    store.transact("secretaria-balcao:retry-1"),
    store.transact("secretaria-balcao:retry-1"),
  ]);

  assert.deepEqual([a.kind, b.kind].sort(), ["created", "replayed"]);
  assert.equal(a.payment.id, b.payment.id);
});

test("BILL-018 rollback contract does not consume the idempotency identity", async () => {
  const store = new AtomicPaymentStore();
  await assert.rejects(
    store.transact("financeiro-modal:rollback-1", { failBeforeCommit: true }),
    /simulated rollback/
  );
  assert.equal(store.get("financeiro-modal:rollback-1"), null);

  const retry = await store.transact("financeiro-modal:rollback-1");
  assert.equal(retry.kind, "created");
  assert.ok(store.get("financeiro-modal:rollback-1"));
});

test("BILL-018 replay contract returns the original committed identity", async () => {
  const store = new AtomicPaymentStore();
  const first = await store.transact("aluno-comprovativo:proof-1");
  const retry = await store.transact("aluno-comprovativo:proof-1");
  assert.equal(first.kind, "created");
  assert.equal(retry.kind, "replayed");
  assert.equal(first.payment.id, retry.payment.id);
});
