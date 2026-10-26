import assert from "node:assert/strict";
import test from "node:test";
import { paymentReceiptKey, paymentReceiptFingerprint, shouldEmitAutomaticPaymentReceipt } from "../../src/lib/server/outbox-transition";
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

test("receipt fingerprint is SHA-256, deterministic and school/payment-scoped", () => {
  const first = paymentReceiptFingerprint("school-a", "payment-a");
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, paymentReceiptFingerprint("school-a", "payment-a"));
  assert.notEqual(first, paymentReceiptFingerprint("school-b", "payment-a"));
  assert.notEqual(first, paymentReceiptFingerprint("school-a", "payment-b"));
  // Both the idempotency key and fingerprint satisfy the production CHECK.
  assert.ok(paymentReceiptKey("payment-a").trim().length >= 8);
  assert.ok(first.trim().length >= 16 && first.trim().length <= 128);
});

test("non-uniqueness insert failure retains SQLSTATE and message for diagnosis", async () => {
  await assert.rejects(
    persistReceiptOnce({
      exists: async () => false,
      insert: async () => ({
        error: {
          code: "23514",
          message: 'violates check constraint "documentos_emitidos_idempotency_pair_chk"',
        },
      }),
    }),
    (err: unknown) =>
      err instanceof Error &&
      (err as Error & { code?: string }).code === "23514" &&
      err.message.includes("documentos_emitidos_idempotency_pair_chk"),
  );
});

test("consolidated batch checkout never emits receipts for intermediate items", () => {
  assert.equal(shouldEmitAutomaticPaymentReceipt({ emitir_recibo: false, batch_index: 0 }), false);
  assert.equal(shouldEmitAutomaticPaymentReceipt({ emitir_recibo: true, batch_index: 2 }), true);
});

test("legacy and malformed receipt metadata cannot suppress a receipt", () => {
  assert.equal(shouldEmitAutomaticPaymentReceipt(null), true);
  assert.equal(shouldEmitAutomaticPaymentReceipt({}), true);
  assert.equal(shouldEmitAutomaticPaymentReceipt({ emitir_recibo: "false" }), true);
  assert.equal(shouldEmitAutomaticPaymentReceipt([]), true);
});
