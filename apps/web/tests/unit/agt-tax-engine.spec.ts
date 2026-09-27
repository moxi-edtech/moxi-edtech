import assert from "node:assert/strict";
import test from "node:test";

import {
  AgtMappingError,
  buildAgtPreparedDocument,
} from "../../src/lib/fiscal/agtInvoicePayload";

function baseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000101",
    empresa_id: "00000000-0000-0000-0000-000000000102",
    tipo_documento: "FT",
    numero_formatado: "FT TEST/1",
    invoice_date: "2026-09-27",
    system_entry: "2026-09-27T12:00:00.000Z",
    cliente_nif: "999999999",
    cliente_nome: "Consumidor final",
    moeda: "AOA",
    taxa_cambio_aoa: null,
    total_liquido_aoa: 100,
    total_impostos_aoa: 14,
    total_bruto_aoa: 114,
    documento_origem_id: null,
    rectifica_documento_id: null,
    payload: {
      cliente: { country: "AO" },
      metadata: {},
    },
    ...overrides,
  };
}

function canonicalItem(overrides: Record<string, unknown> = {}) {
  return {
    linha_no: 1,
    descricao: "Item",
    quantidade: 1,
    preco_unit: 100,
    taxa_iva: 14,
    total_liquido_aoa: 100,
    total_impostos_aoa: 14,
    tax_exemption_code: null,
    tax_exemption_reason: null,
    product_code: "ITEM",
    product_number_code: "ITEM",
    tax_profile_code: "IVA_NORMAL_14_AO",
    tax_profile_version: 1,
    tax_type: "IVA",
    tax_code: "NOR",
    tax_country_region: "AO",
    operation_type: "TB",
    unit_of_measure: "UN",
    product_type: "P",
    unit_price_base: 100,
    settlement_amount: 0,
    total_liquido_moeda: 100,
    total_impostos_moeda: 14,
    total_bruto_moeda: 114,
    ...overrides,
  };
}

test("AGT mapper preserves M21 education exemption from canonical tax engine", () => {
  const prepared = buildAgtPreparedDocument({
    document: baseDocument({
      total_liquido_aoa: 100000,
      total_impostos_aoa: 0,
      total_bruto_aoa: 100000,
    }),
    items: [
      canonicalItem({
        descricao: "Propina",
        product_code: "PROPINA",
        product_number_code: "PROPINA",
        tax_profile_code: "IVA_EDUCACAO_M21",
        tax_code: "ISE",
        taxa_iva: 0,
        tax_exemption_code: "M21",
        tax_exemption_reason: "Ensino isento",
        operation_type: "SE",
        product_type: "S",
        preco_unit: 100000,
        unit_price_base: 100000,
        total_liquido_aoa: 100000,
        total_impostos_aoa: 0,
        total_liquido_moeda: 100000,
        total_impostos_moeda: 0,
        total_bruto_moeda: 100000,
      }),
    ],
    taxRegistrationNumber: "5000000000",
  });

  const line = prepared.document.lines?.[0] as any;
  assert.equal(line.operationType, "SE");
  assert.equal(line.creditAmount, 100000);
  assert.equal(line.taxes[0].taxCode, "ISE");
  assert.equal(line.taxes[0].taxPercentage, 0);
  assert.equal(line.taxes[0].taxContribution, 0);
  assert.equal(line.taxes[0].taxExemptionCode, "M21");
  assert.deepEqual(prepared.document.documentTotals, {
    taxPayable: 0,
    netTotal: 100000,
    grossTotal: 100000,
  });
});

test("AGT mapper preserves discount base, net price and settlement", () => {
  const prepared = buildAgtPreparedDocument({
    document: baseDocument({
      total_liquido_aoa: 90,
      total_impostos_aoa: 12.6,
      total_bruto_aoa: 102.6,
    }),
    items: [
      canonicalItem({
        preco_unit: 90,
        unit_price_base: 100,
        settlement_amount: 10,
        total_liquido_aoa: 90,
        total_impostos_aoa: 12.6,
        total_liquido_moeda: 90,
        total_impostos_moeda: 12.6,
        total_bruto_moeda: 102.6,
      }),
    ],
    taxRegistrationNumber: "5000000000",
  });

  const line = prepared.document.lines?.[0] as any;
  assert.equal(line.unitPriceBase, 100);
  assert.equal(line.unitPrice, 90);
  assert.equal(line.settlementAmount, 10);
  assert.equal(line.creditAmount, 90);
  assert.equal(line.taxes[0].taxContribution, 12.6);
});

test("AGT mapper preserves foreign-currency totals and AOA countervalue", () => {
  const prepared = buildAgtPreparedDocument({
    document: baseDocument({
      moeda: "USD",
      taxa_cambio_aoa: 920,
      total_liquido_aoa: 46000,
      total_impostos_aoa: 6440,
      total_bruto_aoa: 52440,
    }),
    items: [
      canonicalItem({
        preco_unit: 50,
        unit_price_base: 50,
        total_liquido_aoa: 46000,
        total_impostos_aoa: 6440,
        total_liquido_moeda: 50,
        total_impostos_moeda: 7,
        total_bruto_moeda: 57,
      }),
    ],
    taxRegistrationNumber: "5000000000",
  });

  assert.equal(prepared.document.documentTotals.netTotal, 50);
  assert.equal(prepared.document.documentTotals.taxPayable, 7);
  assert.equal(prepared.document.documentTotals.grossTotal, 57);
  assert.deepEqual(prepared.document.documentTotals.currency, {
    currencyCode: "USD",
    currencyAmount: 52440,
    exchangeRate: 920,
  });
});

test("AGT mapper rejects a line without canonical tax profile", () => {
  assert.throws(
    () =>
      buildAgtPreparedDocument({
        document: baseDocument(),
        items: [canonicalItem({ tax_profile_code: null })],
        taxRegistrationNumber: "5000000000",
      }),
    (error: unknown) =>
      error instanceof AgtMappingError &&
      error.code === "AGT_MAPPING_TAX_PROFILE_REQUIRED"
  );
});


test("AGT mapper rejects canonical tax profile without frozen version", () => {
  assert.throws(
    () =>
      buildAgtPreparedDocument({
        document: baseDocument(),
        items: [canonicalItem({ tax_profile_version: null })],
        taxRegistrationNumber: "5000000000",
      }),
    (error: unknown) =>
      error instanceof AgtMappingError &&
      error.code === "AGT_MAPPING_TAX_PROFILE_VERSION_REQUIRED"
  );
});

test("AGT mapper preserves unit price precision instead of recalculating fiscal values", () => {
  const prepared = buildAgtPreparedDocument({
    document: baseDocument({
      total_liquido_aoa: 99.99,
      total_impostos_aoa: 14,
      total_bruto_aoa: 113.99,
    }),
    items: [
      canonicalItem({
        quantidade: 3,
        preco_unit: 33.3333,
        unit_price_base: 33.3333,
        total_liquido_aoa: 99.99,
        total_impostos_aoa: 14,
        total_liquido_moeda: 99.99,
        total_impostos_moeda: 14,
        total_bruto_moeda: 113.99,
      }),
    ],
    taxRegistrationNumber: "5000000000",
  });

  const line = prepared.document.lines?.[0] as any;
  assert.equal(line.unitPriceBase, 33.3333);
  assert.equal(line.unitPrice, 33.3333);
  assert.equal(line.creditAmount, 99.99);
  assert.equal(line.taxes[0].taxContribution, 14);
});
