import assert from "node:assert/strict";
import test from "node:test";

import type { CertificationManifest } from "../../src/lib/fiscal/certification/types";
import {
  buildCertificationSaft,
  extractSaftDocumentNumbers,
  manifestDocumentIds,
} from "../../src/lib/fiscal/certification/saftPack";
import { buildCertificationReadiness } from "../../src/lib/fiscal/certification/readiness";

function manifest(): CertificationManifest {
  const points = {} as CertificationManifest["points"];
  for (let index = 1; index <= 17; index += 1) {
    const point = `P${String(index).padStart(2, "0")}` as keyof typeof points;
    points[point] = {
      point,
      title: point,
      scenarioCode: point,
      status: point === "P13" ? "na" : "planned",
      documents: [],
      blockers: [],
    };
  }
  points.P01 = {
    ...points.P01,
    status: "executed",
    documents: [{
      role: "ft",
      documentoId: "11111111-1111-4111-8111-111111111111",
      numero: "FT TEST/1",
      tipoDocumento: "FT",
    }],
  };
  points.P12 = {
    ...points.P12,
    status: "reused",
    documents: [{
      role: "reuse-p03",
      documentoId: "11111111-1111-4111-8111-111111111111",
      numero: "FT TEST/1",
      tipoDocumento: "FT",
    }],
  };
  return {
    schemaVersion: 1,
    officeReference: "0000498/01180000/AGT/2026",
    runId: "run",
    empresaId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    mode: "dry-run",
    agtEnvironment: "hml",
    externalBlockers: [],
    points,
  };
}

test("manifest document IDs are unique even when P12 reuses P03/P01 evidence", () => {
  assert.deepEqual(manifestDocumentIds(manifest()), [
    "11111111-1111-4111-8111-111111111111",
  ]);
});

test("SAF-T coverage extractor sees invoices, working docs, movement docs and payments", () => {
  const xml = [
    "<InvoiceNo>FT TEST/1</InvoiceNo>",
    "<DocumentNumber>PP TEST/1</DocumentNumber>",
    "<DocumentNumber>GR TEST/1</DocumentNumber>",
    "<PaymentRefNo>RC TEST/1</PaymentRefNo>",
  ].join("");
  assert.deepEqual(
    [...extractSaftDocumentNumbers(xml)].sort(),
    ["FT TEST/1", "GR TEST/1", "PP TEST/1", "RC TEST/1"].sort()
  );
});

test("certification readiness blocks a one-month evidence pack", () => {
  const m = manifest();
  const p16 = Object.fromEntries(
    Object.keys(m.points).map((point) => [
      point,
      {
        status: m.points[point as keyof typeof m.points].status,
        blockers: [],
        documents:
          point === "P01"
            ? [{
                documento_id: "1",
                numero: "FT TEST/1",
                tipo_documento: "FT",
                invoice_date: "2026-09-28",
                status: "emitido",
                cliente_nome: "Cliente",
                cliente_nif: "5002637618",
                moeda: "AOA",
                total_bruto_aoa: 100,
                hash_control: "a",
                pdf: null,
                agt_submission: null,
              }]
            : [],
      },
    ])
  ) as any;

  const readiness = buildCertificationReadiness({ manifest: m, p16 });
  assert.equal(readiness.ok, false);
  assert.ok(
    readiness.externalBlockers.includes("CERTIFICATION_TWO_DISTINCT_MONTHS_REQUIRED")
  );
});
