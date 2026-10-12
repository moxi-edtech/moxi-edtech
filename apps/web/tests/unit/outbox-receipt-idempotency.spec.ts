import assert from "node:assert/strict";
import test from "node:test";
import { paymentReceiptKey } from "../../src/lib/server/outbox-transition";
import { persistReceiptOnce } from "../../src/lib/server/receipt-idempotency";

/**
 * Synthetic Postgres-like store: UNIQUE(school_id,idempotency_key) on insert.
 * Exercises the same read/insert/23505 branch used by the outbox consumer.
 * Document issuance is NOT evidence of WhatsApp/email/physical delivery.
 */
function fakeUniqueReceiptStore() {
  const rows = new Set<string>();
  let inserts = 0;
  return {
    get insertCalls() { return inserts; },
    get documentCount() { return rows.size; },
    forPayment(paymentId: string) {
      const key = `synthetic-school:${paymentReceiptKey(paymentId)}`;
      return {
        exists: async () => rows.has(key),
        insert: async () => {
          inserts += 1;
          if (rows.has(key)) {
            return { error: { code: "23505", message: "synthetic unique conflict" } };
          }
          rows.add(key);
          return { error: null };
        },
      };
    },
  };
}

test("processing exactly the same outbox payment event twice issues ONE receipt", async () => {
  const store = fakeUniqueReceiptStore();
  const payment = store.forPayment("synthetic-payment-1");
  assert.equal(await persistReceiptOnce(payment), "created");
  assert.equal(await persistReceiptOnce(payment), "already_exists");
  assert.equal(store.documentCount, 1);
  assert.equal(store.insertCalls, 1);
});

test("simultaneous duplicate claims yield one document even with a write race", async () => {
  const store = fakeUniqueReceiptStore();
  const payment = store.forPayment("synthetic-payment-1");
  const outcomes = await Promise.all([
    persistReceiptOnce(payment),
    persistReceiptOnce(payment),
  ]);
  assert.deepEqual(outcomes.sort(), ["already_exists", "created"]);
  assert.equal(store.documentCount, 1);
});

test("unrelated 23505 must not be treated as a delivered or emitted receipt", async () => {
  let checked = 0;
  await assert.rejects(
    persistReceiptOnce({
      exists: async () => { checked += 1; return false; },
      insert: async () => ({ error: { code: "23505", message: "other uniqueness constraint" } }),
    }),
    (err: unknown) => err !== null && typeof err === "object" && "code" in err && err.code === "23505",
  );
  assert.equal(checked, 2);
});
