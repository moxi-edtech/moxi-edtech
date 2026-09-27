import assert from "node:assert/strict";
import test from "node:test";

import { buildSaftAoXml } from "../../src/lib/fiscal/saftAo";
import { validateSaftXmlWithXsd } from "../../src/lib/fiscal/saftXsdValidator";

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

const unvalidatedHeader = {
  productId: "KLASSE/MoxiNexa",
  productCompanyTaxId: "5000000001",
  productVersion: "1.0.0",
  taxAccountingBasis: "F" as const,
  softwareCertificateNumber: "0",
};

const certifiedHeader = {
  ...unvalidatedHeader,
  softwareCertificateNumber: "123/AGT/2026",
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
    hash_control: "fe-hash-control-not-used-in-saft",
    saft_hash: null,
    saft_hash_control: null,
    saft_required: false,
    status: "emitido",
    status_date: null,
    status_reason: null,
    source_id: "U-test-issuer",
    status_source_id: "U-test-issuer",
    source_billing: "P" as const,
    series_sort_key: "TEST",
    order_references: [],
    payment_receipt: null,
    itens: [
      {
        linha_no: 1,
        descricao: "Propina",
        product_code: "PROPINA",
        product_number_code: "PROPINA",
        product_type: "S" as const,
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

function build(documentos: ReturnType<typeof invoice>[], header = unvalidatedHeader) {
  return buildSaftAoXml({
    empresa,
    periodoInicio: "2026-09-01",
    periodoFim: "2026-09-30",
    header,
    generatedAtIso: "2026-09-27T13:00:00.000Z",
    documentos,
  });
}

test("unvalidated SAF-T uses Hash=0, TaxTable and net sales polarity", () => {
  const ft = invoice();
  const nc = invoice({
    id: "10000000-0000-0000-0000-000000000002",
    numero: 2,
    numero_formatado: "NC TEST/2",
    tipo_documento: "NC",
    total_liquido_aoa: 50,
    total_impostos_aoa: 0,
    total_bruto_aoa: 50,
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

  const result = build([ft, nc]);

  assert.match(result.xml, /<CompanyID>RC-TEST-001<\/CompanyID>/);
  assert.match(result.xml, /<ProductCompanyTaxID>5000000001<\/ProductCompanyTaxID>/);
  assert.match(result.xml, /<SoftwareValidationNumber>0<\/SoftwareValidationNumber>/);
  assert.match(result.xml, /<Hash>0<\/Hash>/);
  assert.match(result.xml, /<HashControl>0<\/HashControl>/);
  assert.doesNotMatch(result.xml, /fe-hash-control-not-used-in-saft/);
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

test("validated SAF-T requires the dedicated 172-char hash chain", () => {
  assert.throws(
    () => build([invoice()], certifiedHeader),
    /não pertence a uma cadeia SAF-T validada completa/
  );

  const hash = "A".repeat(172);
  const result = build(
    [
      invoice({
        saft_hash: hash,
        saft_hash_control: 1,
        saft_required: true,
      }),
    ],
    certifiedHeader
  );

  assert.match(result.xml, new RegExp(`<Hash>${hash}<\\/Hash>`));
  assert.match(result.xml, /<HashControl>1<\/HashControl>/);
  assert.match(result.xml, /<SoftwareValidationNumber>123\/AGT\/2026<\/SoftwareValidationNumber>/);
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

  const { xml, summary } = build([rc]);

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
        header: { ...unvalidatedHeader, taxAccountingBasis: "C" as never },
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
    () => build([legacyRc]),
    /não possui paymentReceipt\.sourceDocuments/
  );
});

test("SAF-T rejects zero VAT without Mxx evidence", () => {
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
    () => build([invalidExempt]),
    /IVA 0 exige TaxExemptionCode Mxx/
  );
});

test("SAF-T rejects document totals that do not reconcile with lines", () => {
  assert.throws(
    () => build([invoice({ total_bruto_aoa: 999 })]),
    /GrossTotal divergente/
  );
});

test("SAF-T orders SourceDocuments by type, series and sequential number", () => {
  const docs = [
    invoice({
      id: "10000000-0000-0000-0000-000000000011",
      numero: 10,
      numero_formatado: "FT B/10",
      series_sort_key: "B",
    }),
    invoice({
      id: "10000000-0000-0000-0000-000000000012",
      numero: 2,
      numero_formatado: "FT A/2",
      series_sort_key: "A",
    }),
    invoice({
      id: "10000000-0000-0000-0000-000000000013",
      numero: 1,
      numero_formatado: "FT A/1",
      series_sort_key: "A",
    }),
  ];

  const { xml } = build(docs);

  const a1 = xml.indexOf("<InvoiceNo>FT A/1</InvoiceNo>");
  const a2 = xml.indexOf("<InvoiceNo>FT A/2</InvoiceNo>");
  const b10 = xml.indexOf("<InvoiceNo>FT B/10</InvoiceNo>");
  assert.ok(a1 >= 0 && a2 > a1 && b10 > a2);
});


test("SAF-T excludes annulled documents from section TotalDebit/TotalCredit", () => {
  const normal = invoice({
    numero: 1,
    numero_formatado: "FT TEST/1",
    total_liquido_aoa: 100,
    total_impostos_aoa: 14,
    total_bruto_aoa: 114,
  });
  const annulled = invoice({
    id: "10000000-0000-0000-0000-000000000099",
    numero: 2,
    numero_formatado: "FT TEST/2",
    status: "anulado",
    status_date: "2026-09-27T14:30:00.000Z",
    status_reason: "Anulação de teste",
    total_liquido_aoa: 900,
    total_impostos_aoa: 126,
    total_bruto_aoa: 1026,
    itens: [
      {
        ...invoice().itens[0],
        preco_unit: 900,
        total_liquido_aoa: 900,
        total_impostos_aoa: 126,
        total_bruto_aoa: 1026,
      },
    ],
  });

  const result = build([normal, annulled]);

  assert.match(result.xml, /<NumberOfEntries>2<\/NumberOfEntries>/);
  assert.match(result.xml, /<InvoiceStatus>A<\/InvoiceStatus>/);
  assert.equal(result.summary.sections.salesInvoices.totalCredit, 100);
  assert.equal(result.summary.sections.salesInvoices.totalDebit, 0);
});

test("validated SAF-T rejects signed document when exported InvoiceNo would differ", () => {
  assert.throws(
    () =>
      build(
        [
          invoice({
            numero: 1,
            numero_formatado: "FT-000001",
            saft_hash: "A".repeat(172),
            saft_hash_control: 1,
            saft_required: true,
          }),
        ],
        certifiedHeader
      ),
    /incompatível com o tipo FT|não possui InvoiceNo SAF-T canónico/
  );
});

test("validated SAF-T rejects sequential mismatch between InvoiceNo and persisted number", () => {
  assert.throws(
    () =>
      build(
        [
          invoice({
            numero: 2,
            numero_formatado: "FT TEST/1",
            saft_hash: "A".repeat(172),
            saft_hash_control: 1,
            saft_required: true,
          }),
        ],
        certifiedHeader
      ),
    /diverge do contador fiscal persistido|diverge do número fiscal persistido/
  );
});


test("SAF-T exports foreign-currency lines in AOA and original total in Currency", () => {
  const fx = invoice({
    numero_formatado: "FT FX/1",
    moeda: "USD",
    taxa_cambio_aoa: 920,
    total_liquido_aoa: 46000,
    total_impostos_aoa: 6440,
    total_bruto_aoa: 52440,
    itens: [
      {
        ...invoice().itens[0],
        preco_unit: 50,
        total_liquido_aoa: 46000,
        total_impostos_aoa: 6440,
        total_bruto_aoa: 52440,
      },
    ],
  });

  const { xml } = build([fx]);

  assert.match(xml, /<UnitPrice>46000\.0000<\/UnitPrice>/);
  assert.match(xml, /<CreditAmount>46000\.0000<\/CreditAmount>/);
  assert.match(xml, /<CurrencyCode>USD<\/CurrencyCode>/);
  assert.match(xml, /<CurrencyAmount>57\.0000<\/CurrencyAmount>/);
  assert.match(xml, /<ExchangeRate>920\.00000000<\/ExchangeRate>/);
});

test("SAF-T converts line settlement to AOA while keeping net unit price after discount", () => {
  const discounted = invoice({
    numero_formatado: "FT DISC/1",
    total_liquido_aoa: 90,
    total_impostos_aoa: 12.6,
    total_bruto_aoa: 102.6,
    itens: [
      {
        ...invoice().itens[0],
        preco_unit: 100,
        total_liquido_aoa: 90,
        total_impostos_aoa: 12.6,
        total_bruto_aoa: 102.6,
        settlement_amount: 10,
      },
    ],
  });

  const { xml } = build([discounted]);

  assert.match(xml, /<UnitPrice>90\.0000<\/UnitPrice>/);
  assert.match(xml, /<SettlementAmount>10\.0000<\/SettlementAmount>/);
  assert.match(xml, /<CreditAmount>90\.0000<\/CreditAmount>/);
});


test("SAF-T exports real cancellation timestamp/reason and excludes cancelled values from controls", () => {
  const cancelled = invoice({
    id: "10000000-0000-0000-0000-000000000021",
    numero: 21,
    numero_formatado: "FT TEST/21",
    status: "anulado",
    status_date: "2026-09-28T09:30:00.000Z",
    status_reason: "Erro de emissão",
  });

  const { xml, summary } = build([cancelled]);

  assert.match(xml, /<InvoiceStatus>A<\/InvoiceStatus>/);
  assert.match(xml, /<InvoiceStatusDate>2026-09-28T09:30:00\.000Z<\/InvoiceStatusDate>/);
  assert.match(xml, /<Reason>Erro de emissão<\/Reason>/);
  assert.equal(summary.sections.salesInvoices.totalDebit, 0);
  assert.equal(summary.sections.salesInvoices.totalCredit, 0);
});

test("SAF-T never rewrites a noncanonical historical fiscal number", () => {
  assert.throws(
    () =>
      build([
        invoice({
          numero: 81,
          numero_formatado: "2026-000081",
        }),
      ]),
    /não corrige números fiscais históricos/
  );
});


test("generated SAF-T passes the bundled official AO 1.01_01 XSD", async () => {
  const { xml } = build([invoice()]);
  const result = await validateSaftXmlWithXsd({
    xml,
    xsdVersion: "AO_SAFT_1.01",
  });

  assert.equal(result.ok, true);
  assert.equal(result.validator, "xmllint");
});


test("SAF-T MasterFiles preserves product classification and rejects conflicts", () => {
  const goods = invoice({
    tipo_documento: "GR",
    numero_formatado: "GR TEST/1",
    itens: [
      {
        ...invoice().itens[0],
        product_code: "LIVRO",
        product_number_code: "LIVRO",
        product_type: "P" as const,
      },
    ],
  });

  const result = build([goods]);
  assert.match(result.xml, /<ProductType>P<\/ProductType>/);

  assert.throws(
    () =>
      build([
        invoice({
          numero_formatado: "FT TEST/1",
          itens: [
            {
              ...invoice().itens[0],
              product_code: "MESMO",
              product_number_code: "MESMO",
              product_type: "S" as const,
            },
          ],
        }),
        invoice({
          id: "10000000-0000-0000-0000-000000000091",
          numero: 2,
          numero_formatado: "FT TEST/2",
          itens: [
            {
              ...invoice().itens[0],
              product_code: "MESMO",
              product_number_code: "MESMO",
              product_type: "P" as const,
            },
          ],
        }),
      ]),
    /ProductCode MESMO possui ProductType divergente/
  );
});
