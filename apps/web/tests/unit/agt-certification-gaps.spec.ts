import assert from "node:assert/strict";
import test from "node:test";

import { applyFiscalDiscounts } from "../../src/lib/fiscal/discounts";
import {
  CONSUMIDOR_FINAL_NIF,
  buildSaftCustomerIdentity,
  normalizeFiscalCustomerInput,
} from "../../src/lib/fiscal/customerIdentity";
import { resolveFiscalPdfMoney } from "../../src/lib/fiscal/pdfMoney";

test("P07 computes 100 x 0.55 with 8.8% line discount and 1.5% global discount", () => {
  const [item] = applyFiscalDiscounts(
    [
      {
        quantidade: 100,
        preco_unit: 0.55,
        line_discount_pct: 8.8,
        settlement_amount: 0,
      },
    ],
    1.5
  );

  assert.equal(item.unit_price_base, 0.55);
  assert.equal(item.settlement_amount, 5.59);
  assert.equal(item.preco_unit, 0.4941);
});

test("discount normalization rejects ambiguous manual settlement", () => {
  assert.throws(
    () =>
      applyFiscalDiscounts(
        [
          {
            quantidade: 1,
            preco_unit: 100,
            line_discount_pct: 10,
            settlement_amount: 5,
          },
        ],
        2
      ),
    /FISCAL_DISCOUNT_MANUAL_SETTLEMENT_CONFLICT/
  );
});

test("P09/P10 preserve an identified customer name when NIF is absent", () => {
  const customer = normalizeFiscalCustomerInput({
    nome: "Pai sem NIF",
    address_detail: "Rua 1",
    city: "Luanda",
    country: "AO",
  });

  assert.equal(customer.nome, "Pai sem NIF");
  assert.equal(customer.nif, CONSUMIDOR_FINAL_NIF);
  assert.equal(customer.identifiedWithoutNif, true);
  assert.equal(customer.genericConsumidorFinal, false);
  assert.equal(customer.address_detail, "Rua 1");

  const identity = buildSaftCustomerIdentity({
    documentoId: "10000000-0000-0000-0000-000000000123",
    nome: customer.nome,
    nif: customer.nif,
  });

  assert.match(identity.id, /^SNIF-/);
  assert.equal(identity.nome, "Pai sem NIF");
  assert.equal(identity.nif, CONSUMIDOR_FINAL_NIF);
  assert.equal(identity.identifiedWithoutNif, true);
});

test("generic consumer final remains canonical consumer final", () => {
  const customer = normalizeFiscalCustomerInput({
    nome: "Consumidor final",
  });

  assert.equal(customer.nome, "Consumidor final");
  assert.equal(customer.nif, CONSUMIDOR_FINAL_NIF);
  assert.equal(customer.genericConsumidorFinal, true);
});

test("P08 PDF uses original-currency amounts instead of labelling AOA totals as USD", () => {
  const result = resolveFiscalPdfMoney({
    moeda: "USD",
    totalsAoa: {
      incidencia: 46000,
      imposto: 6440,
      totalGeral: 52440,
    },
    items: [
      {
        preco_unit: 50,
        unit_price_base: 50,
        settlement_amount: 0,
        total_liquido_moeda: 50,
        total_impostos_moeda: 7,
        total_bruto_moeda: 57,
        total_bruto_aoa: 52440,
      },
    ],
  });

  assert.equal(result.moeda, "USD");
  assert.deepEqual(result.totals, {
    incidencia: 50,
    imposto: 7,
    totalGeral: 57,
  });
  assert.equal(result.itemAmounts[0].total, 57);
  assert.equal(result.itemAmounts[0].unitPrice, 50);
});
