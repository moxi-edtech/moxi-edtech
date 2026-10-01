import { buildAgtPreparedDocument } from "@/lib/fiscal/mapper";
import { resolveFiscalPdfMoney } from "@/lib/fiscal/pdfMoney";
import type {
  CertificationDatasetSnapshot,
  CertificationDocumentSnapshot,
} from "@/lib/fiscal/certification/evidenceRepository";
import type { CertificationManifest } from "@/lib/fiscal/certification/types";

const AGT_TYPES = new Set(["FT", "FR", "FG", "GF", "NC", "ND", "RC", "RE"]);

function money(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function validateOne(input: {
  doc: CertificationDocumentSnapshot;
  taxRegistrationNumber: string;
  saftXml: string;
  manifest: CertificationManifest;
  snapshotCompanyId: string;
}) {
  const { doc } = input;
  const failures: string[] = [];
  const pdfMoney = resolveFiscalPdfMoney({
    moeda: doc.moeda,
    totalsAoa: {
      incidencia: doc.total_liquido_aoa,
      imposto: doc.total_impostos_aoa,
      totalGeral: doc.total_bruto_aoa,
    },
    items: doc.items,
  });

  if (!input.saftXml.includes(doc.numero_formatado)) {
    failures.push("SAFT_DOCUMENT_NUMBER_MISSING");
  }
  if (!input.saftXml.includes(doc.cliente_nome.replace(/&/g, "&amp;"))) {
    failures.push("SAFT_CUSTOMER_NAME_MISSING");
  }

  const manifestDoc = Object.values(input.manifest.points)
    .flatMap((entry) => entry.documents)
    .find((entry) => entry.documentoId === doc.id);
  if (!manifestDoc?.pdf?.length) failures.push("PDF_EVIDENCE_MISSING");

  let agt: ReturnType<typeof buildAgtPreparedDocument> | null = null;
  if (AGT_TYPES.has(doc.tipo_documento)) {
    try {
      agt = buildAgtPreparedDocument({
        document: {
          id: doc.id,
          empresa_id: input.snapshotCompanyId,
          tipo_documento: doc.tipo_documento,
          numero_formatado: doc.numero_formatado,
          invoice_date: doc.invoice_date,
          system_entry: doc.system_entry,
          cliente_nif: doc.cliente_nif,
          cliente_nome: doc.cliente_nome,
          moeda: doc.moeda,
          taxa_cambio_aoa: doc.taxa_cambio_aoa,
          total_liquido_aoa: doc.total_liquido_aoa,
          total_impostos_aoa: doc.total_impostos_aoa,
          total_bruto_aoa: doc.total_bruto_aoa,
          documento_origem_id: doc.documento_origem_id,
          rectifica_documento_id: doc.rectifica_documento_id,
          agt_document_status: doc.agt_document_status,
          agt_rejected_document_id: doc.agt_rejected_document_id,
          agt_rejected_document_no: doc.agt_rejected_document_no,
          reference_reason: doc.reference_reason,
          contingency_indicator: doc.contingency_indicator,
          payload: doc.payload,
        },
        items: doc.tipo_documento === "RC" ? [] : doc.items,
        taxRegistrationNumber: input.taxRegistrationNumber,
        originDocument: doc.originDocument
          ? {
              numero_formatado: doc.originDocument.numero_formatado,
              invoice_date: doc.originDocument.invoice_date,
            }
          : null,
      } as any);
      if (agt.document.documentNo !== doc.numero_formatado) {
        failures.push("AGT_DOCUMENT_NUMBER_MISMATCH");
      }
      if (agt.document.documentDate !== doc.invoice_date) {
        failures.push("AGT_DOCUMENT_DATE_MISMATCH");
      }
      if (agt.document.customerTaxID !== (doc.cliente_nif ?? "999999999")) {
        failures.push("AGT_CUSTOMER_TAX_ID_MISMATCH");
      }
      if (agt.document.companyName !== doc.cliente_nome.slice(0, 200)) {
        failures.push("AGT_CUSTOMER_NAME_MISMATCH");
      }
    } catch (error) {
      failures.push(
        `AGT_PREPARE_FAILED:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const itemCurrencyTotal = doc.items.reduce(
    (sum, item) => sum + money(item.total_bruto_moeda),
    0
  );
  if (doc.moeda !== "AOA" && Math.abs(pdfMoney.totals.totalGeral - itemCurrencyTotal) > 0.01) {
    failures.push("PDF_FOREIGN_CURRENCY_TOTAL_MISMATCH");
  }

  return {
    documento_id: doc.id,
    numero: doc.numero_formatado,
    tipo_documento: doc.tipo_documento,
    ok: failures.length === 0,
    failures,
    projections: {
      pdf: {
        moeda: pdfMoney.moeda,
        totalGeral: pdfMoney.totals.totalGeral,
      },
      agt: agt?.document ?? null,
    },
  };
}

export function validateCertificationCrossSurface(input: {
  manifest: CertificationManifest;
  snapshot: CertificationDatasetSnapshot;
  saftXml: string;
}) {
  const results = input.snapshot.documents.map((doc) =>
    validateOne({
      doc,
      taxRegistrationNumber: input.snapshot.company.nif,
      saftXml: input.saftXml,
      manifest: input.manifest,
      snapshotCompanyId: input.snapshot.company.id,
    })
  );
  return {
    ok: results.every((result) => result.ok),
    results,
  };
}
