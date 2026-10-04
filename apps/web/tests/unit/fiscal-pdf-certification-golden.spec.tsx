import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";

import {
  FiscalDocumentV1,
  type FiscalPdfDocumentData,
} from "../../src/templates/pdf/fiscal/FiscalDocumentV1";
import { resolveFiscalPdfMoney } from "../../src/lib/fiscal/pdfMoney";

function collectText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object" && "props" in node) {
    return collectText((node as any).props?.children);
  }
  return "";
}

function base(overrides: Partial<FiscalPdfDocumentData> = {}): FiscalPdfDocumentData {
  return {
    tipoDocumento: "FT",
    numeroDocumento: "FT TEST/1",
    dataEmissao: "2026-09-28",
    status: "ASSINADO",
    empresa: {
      nome: "MOXI",
      nif: "5002637618",
      morada: "Luanda",
    },
    cliente: {
      nome: "Cliente Certificação",
      nif: "5002637618",
      morada: "Luanda",
    },
    itens: [
      {
        id: "1",
        codigo: "AGT-1",
        descricao: "Serviço",
        precoUnitario: 100,
        quantidade: 1,
        taxaIva: 14,
        total: 114,
      },
    ],
    totais: {
      incidencia: 100,
      imposto: 14,
      totalGeral: 114,
    },
    moeda: "AOA",
    ...overrides,
  };
}

function pdfText(documento: FiscalPdfDocumentData) {
  return collectText(
    FiscalDocumentV1({
      documento,
      assinaturaCurta: "ABCD",
      agtNumber: "123",
    })
  );
}

test("P07 PDF golden shows base unit price and settlement discount", () => {
  const text = pdfText(
    base({
      numeroDocumento: "FT TEST/7",
      itens: [
        {
          id: "7",
          codigo: "AGT-P07",
          descricao: "100 x 0,55 com descontos",
          precoUnitario: 0.55,
          quantidade: 100,
          taxaIva: 14,
          settlementAmount: 5.59,
          total: 56.33,
        },
      ],
      totais: { incidencia: 49.41, imposto: 6.92, totalGeral: 56.33 },
    })
  );

  assert.match(text, /Desconto/);
  assert.match(text, /0,55 AOA/);
  assert.match(text, /56,33 AOA/);
});

test("P08 PDF currency projection uses original USD totals", () => {
  const money = resolveFiscalPdfMoney({
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

  const text = pdfText(
    base({
      numeroDocumento: "FT FX/8",
      moeda: "USD",
      itens: [
        {
          id: "8",
          codigo: "AGT-P08",
          descricao: "Serviço em USD",
          precoUnitario: money.itemAmounts[0].unitPrice,
          quantidade: 1,
          taxaIva: 14,
          total: money.itemAmounts[0].total,
        },
      ],
      totais: money.totals,
    })
  );

  assert.match(text, /50,00 USD/);
  assert.match(text, /57,00 USD/);
  assert.doesNotMatch(text, /52\.440,00 USD/);
});

test("P09/P10 PDF preserves identified customer without NIF", () => {
  const text = pdfText(
    base({
      numeroDocumento: "FT TEST/9",
      cliente: {
        nome: "Cliente Identificado Sem NIF",
        nif: "999999999",
        morada: "Benguela",
      },
    })
  );

  assert.match(text, /Cliente Identificado Sem NIF/);
  assert.match(text, /NIF: 999999999/);
  assert.match(text, /Benguela/);
  assert.doesNotMatch(text, /Consumidor final/);
});

test("annulled PDF golden renders ANULADA watermark", () => {
  const text = pdfText(base({ status: "ANULADO", numeroDocumento: "FT TEST/2" }));
  assert.match(text, /ANULADA/);
});

test("NC PDF golden exposes its referenced fiscal document", () => {
  const text = pdfText(
    base({
      tipoDocumento: "NC",
      numeroDocumento: "NC TEST/5",
      referencia: {
        numero: "FT TEST/4",
        motivo: "Correção para certificação AGT",
      },
    })
  );

  assert.match(text, /Nota de Crédito n.º NC TEST\/5/);
  assert.match(text, /Documento de origem: FT TEST\/4/);
  assert.match(text, /Motivo: Correção para certificação AGT/);
});

test("P06 PDF golden labels M21 exemption", () => {
  const text = pdfText(
    base({
      itens: [
        {
          id: "m21",
          codigo: "AGT-P06-M21",
          descricao: "Ensino isento",
          precoUnitario: 50,
          quantidade: 1,
          taxaIva: 0,
          motivoIsencaoCode: "M21",
          total: 50,
        },
      ],
      totais: { incidencia: 50, imposto: 0, totalGeral: 50 },
    })
  );

  assert.match(text, /M21 - Isento Artigo 12.º l\) do CIVA/);
});
