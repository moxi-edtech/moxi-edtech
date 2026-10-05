import assert from "node:assert/strict";
import test from "node:test";
import {
  isOverdueRematriculaDebt,
  summarizeOverdueRematriculaDebt,
} from "../../src/lib/rematricula/debt";

test("cobrança futura não bloqueia rematrícula", () => {
  assert.equal(isOverdueRematriculaDebt({
    status: "pendente",
    valor_previsto: 15000,
    valor_pago_total: 0,
    data_vencimento: "2026-10-20",
  }, "2026-10-02"), false);
});

test("cobrança que vence hoje ainda não é dívida vencida", () => {
  assert.equal(isOverdueRematriculaDebt({
    status: "pendente",
    valor_previsto: 15000,
    valor_pago_total: 0,
    data_vencimento: "2026-10-02",
  }, "2026-10-02"), false);
});

test("saldo vencido bloqueia rematrícula", () => {
  assert.equal(isOverdueRematriculaDebt({
    status: "pago_parcial",
    valor_previsto: 15000,
    valor_pago_total: 5000,
    data_vencimento: "2026-10-01",
  }, "2026-10-02"), true);
});

test("pago, isento e cancelado nunca bloqueiam", () => {
  for (const status of ["pago", "isento", "cancelado"]) {
    assert.equal(isOverdueRematriculaDebt({
      status,
      valor_previsto: 15000,
      valor_pago_total: 0,
      data_vencimento: "2026-09-01",
    }, "2026-10-02"), false);
  }
});

test("vencimento ausente não é inferido como inadimplência", () => {
  assert.equal(isOverdueRematriculaDebt({
    status: "pendente",
    valor_previsto: 15000,
    valor_pago_total: 0,
    data_vencimento: null,
  }, "2026-10-02"), false);
});

test("resumo soma apenas saldos vencidos", () => {
  const summary = summarizeOverdueRematriculaDebt([
    { status: "pendente", valor_previsto: 15000, valor_pago_total: 5000, data_vencimento: "2026-10-01" },
    { status: "pendente", valor_previsto: 20000, valor_pago_total: 0, data_vencimento: "2026-10-20" },
    { status: "pago", valor_previsto: 30000, valor_pago_total: 0, data_vencimento: "2026-09-01" },
  ], "2026-10-02");

  assert.equal(summary.count, 1);
  assert.equal(summary.total, 10000);
});
