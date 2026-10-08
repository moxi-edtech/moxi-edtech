import assert from "node:assert/strict";
import test from "node:test";

import { allocateDebtPayment, toDebtReceiptItems } from "../../src/lib/financeiro/debtBatch";

const installments = [
  { id: "old", nome: "Setembro", preco: 4000, origem_matricula_id: "origin-a" },
  { id: "new", nome: "Outubro", preco: 5000, origem_matricula_id: "origin-b" },
];

test("distribui oldest-first, preservando o contexto da matrícula de origem", () => {
  const allocations = allocateDebtPayment(installments, 6500);
  assert.deepEqual(toDebtReceiptItems(allocations), [
    { id: "old", nome: "Setembro", tipo: "mensalidade", preco: 4000, origem_matricula_id: "origin-a" },
    { id: "new", nome: "Outubro", tipo: "mensalidade", preco: 2500, origem_matricula_id: "origin-b" },
  ]);
});

test("pagamento integral gera um único payload de lote com todos os meses", () => {
  const allocations = allocateDebtPayment(installments, 9000);
  assert.equal(allocations.length, 2);
  assert.equal(toDebtReceiptItems(allocations).reduce((sum, item) => sum + item.preco, 0), 9000);
});

test("pagamento parcial num único mês não inclui meses seguintes", () => {
  assert.deepEqual(toDebtReceiptItems(allocateDebtPayment(installments, 1000)).map(i => i.id), ["old"]);
});

test("rejeita valores inválidos e cobranças acima do total", () => {
  assert.throws(() => allocateDebtPayment(installments, 10000), /superior/);
  assert.throws(() => allocateDebtPayment(installments, 0), /inválido/);
  assert.throws(() => allocateDebtPayment(installments, Number.NaN), /inválido/);
});
