import assert from "node:assert/strict";
import test from "node:test";

import {
  AgtMappingError,
  buildAgtPreparedDocument,
} from "../../src/lib/fiscal/agtInvoicePayload";

function baseReceipt() {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    empresa_id: "00000000-0000-0000-0000-000000000002",
    tipo_documento: "RC",
    numero_formatado: "RC TEST/9",
    invoice_date: "2026-09-27",
    system_entry: "2026-09-27T12:00:00.000Z",
    cliente_nif: "999999999",
    cliente_nome: "Consumidor final",
    moeda: "AOA",
    taxa_cambio_aoa: null,
    total_liquido_aoa: 30000,
    total_impostos_aoa: 4200,
    total_bruto_aoa: 34200,
    documento_origem_id: null,
    rectifica_documento_id: null,
    payload: {
      cliente: { country: "AO" },
      paymentReceipt: {
        sourceDocuments: [
          {
            lineNo: 1,
            sourceDocumentID: {
              OriginatingON: "FT TEST/1",
              documentDate: "2026-09-01",
            },
            creditAmount: 15000,
          },
          {
            lineNo: 2,
            sourceDocumentID: {
              OriginatingON: "FT TEST/2",
              documentDate: "2026-09-02",
            },
            creditAmount: 15000,
          },
        ],
      },
      metadata: {},
    },
  };
}

test("RC maps to paymentReceipt without lines", () => {
  const prepared = buildAgtPreparedDocument({
    document: baseReceipt(),
    items: [],
    taxRegistrationNumber: "5000000000",
  });

  assert.equal(prepared.document.documentType, "RC");
  assert.equal("lines" in prepared.document, false);
  assert.deepEqual(prepared.document.paymentReceipt, {
    sourceDocuments: [
      {
        lineNo: 1,
        sourceDocumentID: {
          OriginatingON: "FT TEST/1",
          documentDate: "2026-09-01",
        },
        creditAmount: 15000,
      },
      {
        lineNo: 2,
        sourceDocumentID: {
          OriginatingON: "FT TEST/2",
          documentDate: "2026-09-02",
        },
        creditAmount: 15000,
      },
    ],
  });
  assert.deepEqual(prepared.document.documentTotals, {
    taxPayable: 4200,
    netTotal: 30000,
    grossTotal: 34200,
  });
});

test("RC rejects invoice lines", () => {
  assert.throws(
    () =>
      buildAgtPreparedDocument({
        document: baseReceipt(),
        items: [
          {
            linha_no: 1,
            descricao: "Não permitido em RC",
            quantidade: 1,
            preco_unit: 1,
            taxa_iva: 14,
            total_liquido_aoa: 1,
            total_impostos_aoa: 0.14,
            tax_exemption_code: null,
            product_code: "TEST",
            product_number_code: "TEST",
          },
        ],
        taxRegistrationNumber: "5000000000",
      }),
    (error: unknown) =>
      error instanceof AgtMappingError &&
      error.code === "AGT_MAPPING_RECEIPT_LINES_FORBIDDEN"
  );
});

test("RC rejects non-sequential sourceDocuments", () => {
  const doc = baseReceipt();
  const paymentReceipt = doc.payload.paymentReceipt as {
    sourceDocuments: Array<Record<string, unknown>>;
  };
  paymentReceipt.sourceDocuments[1] = {
    ...paymentReceipt.sourceDocuments[1],
    lineNo: 3,
  };

  assert.throws(
    () =>
      buildAgtPreparedDocument({
        document: doc,
        items: [],
        taxRegistrationNumber: "5000000000",
      }),
    (error: unknown) =>
      error instanceof AgtMappingError &&
      error.code === "AGT_MAPPING_RECEIPT_LINE_SEQUENCE_INVALID"
  );
});
