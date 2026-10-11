import assert from "node:assert/strict";
import test from "node:test";
import { buildOutboxTransition, paymentReceiptKey } from "../../src/lib/server/outbox-transition";

const at = new Date("2026-10-11T10:00:00.000Z");

test("claim-success always uses a non-null scheduled timestamp", () => {
  const result = buildOutboxTransition({ status: "sent", attempts: 1, maxAttempts: 5, now: at });
  assert.equal(result.status, "sent");
  assert.equal(result.next_attempt_at, at.toISOString());
  assert.equal(result.processed_at, at.toISOString());
  assert.equal(result.locked_by, null);
});

test("failed event retries with increasing backoff, without clearing NOT NULL", () => {
  const first = buildOutboxTransition({ status: "failed", attempts: 1, maxAttempts: 5, now: at, lastError: "transient" });
  const second = buildOutboxTransition({ status: "failed", attempts: 2, maxAttempts: 5, now: at });
  assert.equal(first.status, "failed");
  assert.equal(first.last_error, "transient");
  assert.ok(Date.parse(first.next_attempt_at) > at.getTime());
  assert.ok(Date.parse(second.next_attempt_at) > Date.parse(first.next_attempt_at));
  assert.equal(first.processed_at, null);
});

test("terminal dead is timestamped and does not request another retry", () => {
  const result = buildOutboxTransition({ status: "failed", attempts: 5, maxAttempts: 5, now: at });
  assert.equal(result.status, "dead");
  assert.equal(result.next_attempt_at, at.toISOString());
  assert.equal(result.processed_at, null);
});

test("receipt key is stable across replay attempts", () => {
  assert.equal(paymentReceiptKey("synthetic-payment"), paymentReceiptKey("synthetic-payment"));
  assert.notEqual(paymentReceiptKey("synthetic-payment"), paymentReceiptKey("other-payment"));
});
