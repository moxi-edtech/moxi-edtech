import assert from "node:assert/strict";
import test from "node:test";

import { buildPaymentIdempotencyKey } from "../../src/lib/financeiro/paymentIdempotency";

test("payment idempotency is deterministic inside the same scope", () => {
  assert.equal(
    buildPaymentIdempotencyKey("financeiro-registro", "  request-123  "),
    "financeiro-registro:request-123",
  );
});

test("payment idempotency isolates equal client keys across entrypoints", () => {
  assert.notEqual(
    buildPaymentIdempotencyKey("financeiro-registro", "request-123"),
    buildPaymentIdempotencyKey("secretaria-balcao", "request-123"),
  );
});

test("payment idempotency rejects missing or invalid identities", () => {
  assert.equal(buildPaymentIdempotencyKey("financeiro-registro", ""), null);
  assert.equal(buildPaymentIdempotencyKey("INVALID SCOPE", "request-123"), null);
});

test("payment idempotency enforces the database key length boundary", () => {
  assert.equal(buildPaymentIdempotencyKey("mcx-init", "x".repeat(192)), null);
});
