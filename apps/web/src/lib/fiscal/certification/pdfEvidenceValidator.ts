import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { resolveFiscalPdfMoney } from "@/lib/fiscal/pdfMoney";
import type {
  CertificationDatasetSnapshot,
  CertificationDocumentSnapshot,
} from "@/lib/fiscal/certification/evidenceRepository";
import type { CertificationManifest } from "@/lib/fiscal/certification/types";

const execFileAsync = promisify(execFile);

function formatCurrency(value: number, currency: string) {
  const normalized = Number.isFinite(value) ? value : 0;
  const sign = normalized < 0 ? "-" : "";
  const [integerRaw, decimal] = Math.abs(normalized).toFixed(2).split(".");
  const integer = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${integer},${decimal} ${currency}`;
}

function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function systemExtractText(pdfPath: string) {
  try {
    const { stdout } = await execFileAsync("pdftotext", [pdfPath, "-"], {
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    return stdout;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error("PDF_TEXT_EXTRACTOR_UNAVAILABLE");
    }
    throw new Error(
      `PDF_TEXT_EXTRACTION_FAILED:${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function expectedPdfStrings(
  doc: CertificationDocumentSnapshot,
  variant: string
) {
  const values = [
    doc.numero_formatado,
    doc.cliente_nome,
    doc.cliente_nif ?? "999999999",
  ];

  const money = resolveFiscalPdfMoney({
    moeda: doc.moeda,
    totalsAoa: {
      incidencia: doc.total_liquido_aoa,
      imposto: doc.total_impostos_aoa,
      totalGeral: doc.total_bruto_aoa,
    },
    items: doc.items,
  });
  values.push(formatCurrency(money.totals.totalGeral, money.moeda));

  if (doc.items.some((item) => Number(item.settlement_amount ?? 0) > 0)) {
    const settlement = doc.items.reduce(
      (sum, item) => sum + Number(item.settlement_amount ?? 0),
      0
    );
    values.push(formatCurrency(settlement, money.moeda));
    values.push("Desconto");
  }

  if (doc.originDocument) {
    values.push(doc.originDocument.numero_formatado);
    values.push("Documento de origem");
  }

  if (variant === "after-annulment" || doc.status === "anulado") {
    values.push("ANULADA");
  }

  return values;
}

export async function validateCertificationPdfEvidence(input: {
  manifest: CertificationManifest;
  snapshot: CertificationDatasetSnapshot;
  extractText?: (pdfPath: string) => Promise<string>;
  readBytes?: (pdfPath: string) => Promise<Buffer>;
}) {
  const extractText = input.extractText ?? systemExtractText;
  const readBytes = input.readBytes ?? (async (pdfPath: string) => readFile(pdfPath));
  const byId = new Map(input.snapshot.documents.map((doc) => [doc.id, doc]));
  const results: {
    point: string;
    documento_id: string;
    path: string | null;
    variant: string | null;
    ok: boolean;
    failures: string[];
  }[] = [];

  for (const [point, entry] of Object.entries(input.manifest.points)) {
    if (!/^P(?:0[1-9]|1[0-5])$/.test(point)) continue;

    for (const manifestDoc of entry.documents) {
      const doc = byId.get(manifestDoc.documentoId);
      if (!doc) {
        results.push({
          point,
          documento_id: manifestDoc.documentoId,
          path: null,
          variant: null,
          ok: false,
          failures: ["PDF_DOCUMENT_SNAPSHOT_MISSING"],
        });
        continue;
      }

      if (!manifestDoc.pdf?.length) {
        results.push({
          point,
          documento_id: doc.id,
          path: null,
          variant: null,
          ok: false,
          failures: ["PDF_EVIDENCE_MISSING"],
        });
        continue;
      }

      for (const pdf of manifestDoc.pdf) {
        const failures: string[] = [];
        let text = "";
        try {
          const bytes = await readBytes(pdf.path);
          const sha = createHash("sha256").update(bytes).digest("hex");
          if (sha !== pdf.sha256) failures.push("PDF_SHA256_MISMATCH");
          text = normalizePdfText(await extractText(pdf.path));
        } catch (error) {
          failures.push(
            error instanceof Error ? error.message : "PDF_TEXT_EXTRACTION_FAILED"
          );
        }

        for (const expected of expectedPdfStrings(doc, pdf.variant)) {
          if (text && !text.includes(expected)) {
            failures.push(`PDF_TEXT_MISSING:${expected}`);
          }
        }

        results.push({
          point,
          documento_id: doc.id,
          path: pdf.path,
          variant: pdf.variant,
          ok: failures.length === 0,
          failures,
        });
      }
    }
  }

  return {
    ok: results.length > 0 && results.every((result) => result.ok),
    extractor: "pdftotext",
    results,
  };
}
