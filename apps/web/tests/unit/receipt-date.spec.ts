import assert from "node:assert/strict";
import test from "node:test";
import { formatReceiptDate } from "../../src/lib/financeiro/receiptDate";

test("preserva a data civil de um pagamento sem deslocamento de fuso", () => {
  assert.equal(formatReceiptDate("2026-10-08"), "08/10/2026");
  assert.equal(formatReceiptDate("2026-01-01"), "01/01/2026");
  assert.equal(formatReceiptDate("2026-10-08T00:30:00Z"), "08/10/2026");
});

test("mantém fallback em dados inválidos ou ausentes", () => {
  assert.equal(formatReceiptDate("2026-02-30"), "2026-02-30");
  assert.equal(formatReceiptDate(null), "—");
});
