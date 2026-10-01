import assert from "node:assert/strict";
import test from "node:test";
import {
  isPaymentSettledStatus,
  resolveCheckoutPaymentState,
} from "../../src/lib/financeiro/checkout-payment-state";

test("cash/settled libera ações dependentes do pagamento", () => {
  assert.deepEqual(
    resolveCheckoutPaymentState({ data: { id: "p1", status: "settled" } }),
    { state: "settled", statuses: ["settled"] },
  );
});

test("TPA/transfer pending nunca é apresentado como pago", () => {
  assert.deepEqual(
    resolveCheckoutPaymentState({ data: { id: "p1", status: "pending" } }),
    { state: "pending", statuses: ["pending"] },
  );
});

test("batch só fica liquidado quando todas as linhas estão liquidadas", () => {
  assert.equal(
    resolveCheckoutPaymentState({
      pagamentos: [
        { id: "p1", status: "settled" },
        { id: "p2", status: "pending" },
      ],
    }).state,
    "pending",
  );

  assert.equal(
    resolveCheckoutPaymentState({
      pagamentos: [
        { id: "p1", status: "settled" },
        { id: "p2", status: "paid" },
      ],
    }).state,
    "settled",
  );
});

test("resposta sem estado nunca libera documento", () => {
  assert.deepEqual(resolveCheckoutPaymentState({ ok: true }), {
    state: "unknown",
    statuses: [],
  });
});

test("aliases confirmados continuam reconhecidos como liquidados", () => {
  for (const status of ["settled", "confirmed", "confirmado", "pago", "paid", "succeeded"]) {
    assert.equal(isPaymentSettledStatus(status), true, status);
  }

  for (const status of ["pending", "failed", "", null]) {
    assert.equal(isPaymentSettledStatus(status), false, String(status));
  }
});
