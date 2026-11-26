import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mapIssuedMonthlyReceipts, mapIssuedBatchPaymentReceipts } from "../../src/lib/financeiro/issued-monthly-receipts";

const ids = ["sep", "oct", "nov", "unpaid"];
const items = ids.slice(0, 3).map(id => ({ tipo: "mensalidade", id, preco: 3000 }));
const doc = { id: "original", mensalidade_id: null, dados_snapshot: { pagamento_id: "service", itens_pagamento: [...items, { tipo: "servico", id: "fee", preco: 1800 }] } };
const payments = [
  ...ids.slice(0, 3).map((id, index) => ({ id: "p-"+id, mensalidade_id: id, valor_pago: 3000, meta: { emitir_recibo: false, batch_idempotency_key: "batch-a", batch_fingerprint: "fingerprint-a", batch_index: index } })),
  { id: "service", mensalidade_id: null, valor_pago: 1800, meta: { emitir_recibo: true, batch_idempotency_key: "batch-a", batch_fingerprint: "fingerprint-a", batch_index: 3 } },
];

test("a rematricula consolidated receipt is reused for all settled monthly items, not unpaid or services", () => {
  assert.deepEqual([...mapIssuedMonthlyReceipts([doc], payments, [...ids, "fee"])], [
    ["sep", "original"], ["oct", "original"], ["nov", "original"],
  ]);
});
test("missing or ambiguous issuer, unrelated batch, and malformed snapshot fail closed", () => {
  assert.equal(mapIssuedMonthlyReceipts([doc], payments.slice(0, 3), ids).size, 0);
  assert.equal(mapIssuedMonthlyReceipts([doc], [...payments, {...payments[3], id: "duplicate"}], ids).size, 0);
  assert.equal(mapIssuedMonthlyReceipts([{...doc, dados_snapshot: null}], payments, ids).size, 0);
  assert.equal(mapIssuedMonthlyReceipts([doc], [{...payments[0], meta: { emitir_recibo: false, batch_idempotency_key: "other" }}, payments[3]], ids).size, 0);
});
test("scope limits output, legacy direct links survive and newest receipt wins", () => {
  const direct = { id: "direct", mensalidade_id: "sep", dados_snapshot: null };
  assert.deepEqual([...mapIssuedMonthlyReceipts([direct, doc], payments, ["sep","oct"])], [["sep","direct"],["oct","original"]]);
  assert.deepEqual([...mapIssuedMonthlyReceipts([doc, direct], payments, ["sep"])], [["sep","original"]]);
  assert.equal(mapIssuedMonthlyReceipts([direct], [], ["oct"]).size, 0);
});
test("both channels reuse authenticated, school/student scoped read-only lookup", () => {
  const src = (path: string) => readFileSync(new URL("../../src/"+path, import.meta.url), "utf8");
  const helper = src("lib/financeiro/issued-monthly-receipts.ts");
  for (const path of ["lib/aluno/load-dossier-data.ts","app/api/aluno/financeiro/route.ts"]) {
    assert.match(src(path), /loadIssuedMonthlyReceipts\(supabase,/);
  }
  assert.match(helper, /\.eq\("escola_id", escolaId\)\.eq\("aluno_id", alunoId\)/);
  assert.match(helper, /\.is\("revoked_at", null\)/);
  assert.match(helper, /\.eq\("status", "settled"\)/);
  assert.doesNotMatch(helper, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|supabaseServerRole/);
});

test("payment lookup returns the same original receipt for the exact four batch members", () => {
  assert.deepEqual([...mapIssuedBatchPaymentReceipts([doc], payments)], [
    ["p-sep","original"], ["p-oct","original"], ["p-nov","original"], ["service","original"],
  ]);
  assert.equal(mapIssuedBatchPaymentReceipts([doc], payments.map((p,i) => i===0 ? {...p, valor_pago: 2900} : p)).size, 0);
  assert.equal(mapIssuedBatchPaymentReceipts([doc], payments.map((p,i) => i===0 ? {...p, meta: {...p.meta, batch_fingerprint:"other"}} : p)).size, 0);
});
