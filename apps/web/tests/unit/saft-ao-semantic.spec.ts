import assert from "node:assert/strict";
import test from "node:test";

import { buildSaftAoXml } from "../../src/lib/fiscal/saftAo";

const empresa = {
  id: "00000000-0000-0000-0000-000000000001",
  nome: "Escola Fiscal Teste",
  nif: "5000000000",
  endereco: "Rua Fiscal 1",
  registoComercial: "RC-TEST-001",
  cidade: "Luanda",
  provincia: "Luanda",
  codigoPostal: null,
  certificadoAgtNumero: null,
};

const header = {
  productId: "KLASSE/MoxiNexa",
  productCompanyTaxId: "5000000001",
  productVersion: "1.0.0",
  taxAccountingBasis: "F" as const,
  softwareCertificateNumber: "0",
};

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    numero: 1,
    numero_formatado: "FT TEST/1",
    tipo_documento: "FT",
    invoice_date: "2026-09-27",
    system_entry: "2026-09-27T12:00:00.000Z",
    cliente_nome: "Consumidor final",
    cliente_nif: "999999999",
    address_detail: null,
    city: null,
    postal_code: null,
    country: null,
    moeda: "AOA",
    taxa_cambio_aoa: null,
    payment_mechanism: null,
    total_liquido_aoa: 100,
    total_impostos_aoa: 14,
    total_bruto_aoa: 114,
    hash_control: "legacy-hash-control-not-exported",
    saft_hash: "A".repeat(172),
    saft_hash_control: 3,
    status: "emitido",
    source_billing: "P" as const,
    order_references: [],
    payment_receipt: null,
    itens: [
      {
        linha_no: 1,
        descricao: "Propina",
        product_code: "PROPINA",
        product_number_code: "PROPINA",
        quantidade: 1,
        preco_unit: 100,
        taxa_iva: 14,
        total_liquido_aoa: 100,
        total_impostos_aoa: 14,
        total_bruto_aoa: 114,
        settlement_amount: null,
        tax_exemption_code: null,
        tax_exemption_reason: null,
      },
    ],
    ...overrides,
  };
}

test("SAF-T F exports signed hash, key version, TaxTable and net sales polarity", () => {
  const ft = invoice();
  const nc = invoice({
    id: "10000000-0000-0000-0000-000000000002",
    numero: 2,
    numero_formatado: "NC TEST/2",
    tipo_documento: "NC",
    total_liquido_aoa: 50,
    total_impostos_aoa: 0,
    total_bruto_aoa: 50,
    saft_hash: "B".repeat(172),
    saft_hash_control: 4,
    order_references: [
      {
        reference: "FT TEST/1",
        reason: "Correcção",
        origin_invoice_date: "2026-09-27",
      },
    ],
    itens: [
      {
        linha_no: 1,
        descricao: "Ajuste de propina",
        product_code: "PROPINA",
        product_number_code: "PROPINA",
        quantidade: 1,
        preco_unit: 50,
        taxa_iva: 0,
        total_liquido_aoa: 50,
        total_impostos_aoa: 0,
        total_bruto_aoa: 50,
        settlement_amount: null,
        tax_exemption_code: "M07",
        tax_exemption_reason: "Isencao de IVA - servicos de educacao",
      },
    ],
  });

  const result = buildSaftAoXml({
    empresa,
    periodoInicio: "2026-09-01",
    periodoFim: "2026-09-30",
    header,
    generatedAtIso: "2026-09-27T13:00:00.000Z",
    documentos: [ft, nc],
  });

  assert.match(result.xml, /<CompanyID>RC-TEST-001<\/CompanyID>/);
  assert.match(result.xml, /<ProductCompanyTaxID>5000000001<\/ProductCompanyTaxID>/);
  assert.match(result.xml, new RegExp(`<Hash>${"A".repeat(172)}<\\/Hash>`));
  assert.match(result.xml, /<HashControl>3<\/HashControl>/);
  assert.doesNotMatch(result.xml, /<Hash>legacy-hash-control-not-exported<\/Hash>/);
  assert.match(result.xml, /<TaxTable>/);
  assert.match(result.xml, /<TaxCode>NOR<\/TaxCode>/);
  assert.match(result.xml, /<TaxCode>ISE<\/TaxCode>/);
  assert.match(result.xml, /<TaxExemptionCode>M07<\/TaxExemptionCode>/);
  assert.match(result.xml, /<CreditAmount>100\.0000<\/CreditAmount>/);
  assert.match(result.xml, /<DebitAmount>50\.0000<\/DebitAmount>/);
  assert.match(result.xml, /<TotalDebit>50\.0000<\/TotalDebit>/);
  assert.match(result.xml, /<TotalCredit>100\.0000<\/TotalCredit>/);
  assert.equal(result.summary.sections.salesInvoices.totalDebit, 50);
  assert.equal(result.summary.sections.salesInvoices.totalCredit, 100);
  assert.equal(result.summary.sections.taxTableEntries, 2);
});

test("SAF-T RC uses canonical paymentReceipt.sourceDocuments without fiscal item lines", () => {
  const rc = invoice({
    id: "10000000-0000-0000-0000-000000000003",
    numero: 9,
    numero_formatado: "RC TEST/9",
    tipo_documento: "RC",
    payment_mechanism: "NU",
    total_liquido_aoa: 100,
    total_impostos_aoa: 14,
    total_bruto_aoa: 114,
    saft_hash: "C".repeat(172),
    saft_hash_control: 5,
    itens: [],
    payment_receipt: {
      sourceDocuments: [
        {
          lineNo: 1,
          sourceDocumentID: {
            OriginatingON: "FT TEST/1",
            documentDate: "2026-09-27",
          },
          creditAmount: 100,
        },
      ],
    },
  });

  const { xml, summary } = buildSaftAoXml({
    empresa,
    periodoInicio: "2026-09-01",
    periodoFim: "2026-09-30",
    header,
    generatedAtIso: "2026-09-27T13:00:00.000Z",
    documentos: [rc],
  });

  assert.match(xml, /<Payments>/);
  assert.match(xml, /<OriginatingON>FT TEST\/1<\/OriginatingON>/);
  assert.match(xml, /<InvoiceDate>2026-09-27<\/InvoiceDate>/);
  assert.match(xml, /<CreditAmount>100\.0000<\/CreditAmount>/);
  assert.match(xml, /<PaymentAmount>114\.0000<\/PaymentAmount>/);
  assert.equal(summary.sections.payments.totalCredit, 100);
  assert.equal(summary.totalItens, 0);
});

test("SAF-T rejects accounting basis without a true accounting ledger", () => {
  assert.throws(
    () =>
      buildSaftAoXml({
        empresa,
        periodoInicio: "2026-09-01",
        periodoFim: "2026-09-30",
        header: { ...header, taxAccountingBasis: "C" as never },
        generatedAtIso: "2026-09-27T13:00:00.000Z",
        documentos: [],
      }),
    /SAFT_SEMANTIC_ERROR: KLASSE exporta SAF-T de Facturação/
  );
});

test("SAF-T rejects legacy RC without sourceDocuments", () => {
  const legacyRc = invoice({
    numero_formatado: "RC LEGACY/1",
    tipo_documento: "RC",
    itens: [],
    payment_receipt: null,
  });

  assert.throws(
    () =>
      buildSaftAoXml({
        empresa,
        periodoInicio: "2026-09-01",
        periodoFim: "2026-09-30",
        header,
        generatedAtIso: "2026-09-27T13:00:00.000Z",
        documentos: [legacyRc],
      }),
    /não possui paymentReceipt\.sourceDocuments/
  );
});

test("SAF-T rejects unsigned documents and zero VAT without Mxx evidence", () => {
  assert.throws(
    () =>
      buildSaftAoXml({
        empresa,
        periodoInicio: "2026-09-01",
        periodoFim: "2026-09-30",
        header,
        generatedAtIso: "2026-09-27T13:00:00.000Z",
        documentos: [invoice({ saft_hash: null })],
      }),
    /sem saft_hash\/saft_hash_control válido/
  );

  const invalidExempt = invoice({
    total_liquido_aoa: 100,
    total_impostos_aoa: 0,
    total_bruto_aoa: 100,
    itens: [
      {
        ...invoice().itens[0],
        taxa_iva: 0,
        total_impostos_aoa: 0,
        total_bruto_aoa: 100,
        tax_exemption_code: null,
        tax_exemption_reason: null,
      },
    ],
  });

  assert.throws(
    () =>
      buildSaftAoXml({
        empresa,
        periodoInicio: "2026-09-01",
        periodoFim: "2026-09-30",
        header,
        generatedAtIso: "2026-09-27T13:00:00.000Z",
        documentos: [invalidExempt],
      }),
    /IVA 0 exige TaxExemptionCode Mxx/
  );
});
