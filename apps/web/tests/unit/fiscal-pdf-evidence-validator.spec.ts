import assert from "node:assert/strict";
import test from "node:test";

import { validateCertificationPdfEvidence } from "../../src/lib/fiscal/certification/pdfEvidenceValidator";
import type { CertificationManifest } from "../../src/lib/fiscal/certification/types";

function fixture() {
  const points: any = {};
  for (let index = 1; index <= 17; index++) {
    const point = `P${String(index).padStart(2, "0")}`;
    points[point] = {
      point,
      title: point,
      status: point === "P13" ? "na" : "planned",
      scenarioCode: point,
      documents: [],
      blockers: [],
    };
  }
  points.P07 = {
    ...points.P07,
    status: "executed",
    documents: [{
      role: "ft",
      documentoId: "d7",
      numero: "FT TEST/7",
      tipoDocumento: "FT",
      pdf: [{
        path: "/fake/p07.pdf",
        sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        variant: "current",
      }],
    }],
  };

  const manifest: CertificationManifest = {
    schemaVersion: 1,
    officeReference: "0000498/01180000/AGT/2026",
    runId: "run",
    empresaId: "e1",
    createdAt: "2026-09-28T00:00:00Z",
    updatedAt: "2026-09-28T00:00:00Z",
    mode: "execute",
    agtEnvironment: "hml",
    externalBlockers: [],
    points,
  };

  const snapshot: any = {
    company: { id: "e1", nome: "MOXI", nif: "5002637618", metadata: {} },
    documents: [{
      id: "d7",
      numero: 7,
      numero_formatado: "FT TEST/7",
      tipo_documento: "FT",
      invoice_date: "2026-09-28",
      system_entry: "2026-09-28T08:00:00Z",
      cliente_nome: "Cliente Certificação",
      cliente_nif: "5002637618",
      payload: {},
      moeda: "AOA",
      taxa_cambio_aoa: null,
      payment_mechanism: null,
      total_liquido_aoa: 49.41,
      total_impostos_aoa: 6.92,
      total_bruto_aoa: 56.33,
      hash_control: "hash",
      status: "emitido",
      serie_id: "s1",
      items: [{
        linha_no: 1,
        descricao: "Desconto",
        product_code: "P07",
        product_number_code: "P07",
        quantidade: 100,
        preco_unit: 0.4941,
        unit_price_base: 0.55,
        settlement_amount: 5.59,
        taxa_iva: 14,
        total_liquido_aoa: 49.41,
        total_impostos_aoa: 6.92,
        total_bruto_aoa: 56.33,
        total_liquido_moeda: 49.41,
        total_impostos_moeda: 6.92,
        total_bruto_moeda: 56.33,
      }],
      series: { origem_documento: "integrado", prefixo: "TEST", agt_series_code: "TEST" },
      originDocument: null,
      agtSubmission: null,
      cancellation: null,
    }],
  };

  return { manifest, snapshot };
}

test("cross-PDF validator verifies hash and expected fiscal text", async () => {
  const { manifest, snapshot } = fixture();
  const result = await validateCertificationPdfEvidence({
    manifest,
    snapshot,
    readBytes: async () => Buffer.from("test"),
    extractText: async () =>
      "Fatura FT TEST/7 Cliente Certificação NIF: 5002637618 Total 56,33 AOA Desconto 5,59 AOA",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.results[0].failures, []);
});

test("cross-PDF validator fails when a required fiscal field is absent", async () => {
  const { manifest, snapshot } = fixture();
  const result = await validateCertificationPdfEvidence({
    manifest,
    snapshot,
    readBytes: async () => Buffer.from("test"),
    extractText: async () => "FT TEST/7",
  });

  assert.equal(result.ok, false);
  assert.ok(result.results[0].failures.some((failure) => failure.includes("Cliente Certificação")));
});
