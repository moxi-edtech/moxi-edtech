import { describe, expect, it } from "vitest";
import { buildPaymentIdempotencyKey } from "@/lib/financeiro/paymentIdempotency";

describe("payment idempotency keys", () => {
  it("is deterministic inside the same scope", () => {
    expect(buildPaymentIdempotencyKey("financeiro-registro", "  request-123  "))
      .toBe("financeiro-registro:request-123");
  });

  it("isolates equal client keys across payment entrypoints", () => {
    expect(buildPaymentIdempotencyKey("financeiro-registro", "request-123"))
      .not.toBe(buildPaymentIdempotencyKey("secretaria-balcao", "request-123"));
  });

  it("rejects missing or invalid identities", () => {
    expect(buildPaymentIdempotencyKey("financeiro-registro", "")).toBeNull();
    expect(buildPaymentIdempotencyKey("INVALID SCOPE", "request-123")).toBeNull();
  });

  it("enforces the database key length boundary", () => {
    expect(buildPaymentIdempotencyKey("mcx-init", "x".repeat(192))).toBeNull();
  });
});
