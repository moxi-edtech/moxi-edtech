import type {
  CertificationDatasetSnapshot,
  CertificationDocumentSnapshot,
} from "@/lib/fiscal/certification/evidenceRepository";
import type {
  CertificationManifest,
  CertificationPoint,
} from "@/lib/fiscal/certification/types";

export type P16DocumentEvidence = {
  documento_id: string;
  numero: string;
  tipo_documento: string;
  invoice_date: string;
  status: string;
  cliente_nome: string;
  cliente_nif: string | null;
  moeda: string;
  total_bruto_aoa: number | string;
  hash_control: string;
  pdf: unknown;
  agt_submission: CertificationDocumentSnapshot["agtSubmission"];
};

export type P16Evidence = Record<
  CertificationPoint,
  {
    status: string;
    blockers: string[];
    documents: P16DocumentEvidence[];
  }
>;

export function buildP16Evidence(input: {
  manifest: CertificationManifest;
  snapshot: CertificationDatasetSnapshot;
}): P16Evidence {
  const byId = new Map(input.snapshot.documents.map((doc) => [doc.id, doc]));
  const output = {} as P16Evidence;

  for (const [point, entry] of Object.entries(input.manifest.points) as [
    CertificationPoint,
    CertificationManifest["points"][CertificationPoint],
  ][]) {
    output[point] = {
      status: entry.status,
      blockers: [...entry.blockers],
      documents: entry.documents.map((manifestDoc) => {
        const doc = byId.get(manifestDoc.documentoId);
        if (!doc) {
          throw new Error(
            `P16_DOCUMENT_SNAPSHOT_MISSING:${point}:${manifestDoc.documentoId}`
          );
        }
        return {
          documento_id: doc.id,
          numero: doc.numero_formatado,
          tipo_documento: doc.tipo_documento,
          invoice_date: doc.invoice_date,
          status: doc.status,
          cliente_nome: doc.cliente_nome,
          cliente_nif: doc.cliente_nif,
          moeda: doc.moeda,
          total_bruto_aoa: doc.total_bruto_aoa,
          hash_control: doc.hash_control,
          pdf: manifestDoc.pdf ?? null,
          agt_submission: doc.agtSubmission,
        };
      }),
    };
  }

  return output;
}

export function certificationEvidenceMonths(p16: P16Evidence) {
  return Array.from(
    new Set(
      Object.values(p16)
        .flatMap((entry) => entry.documents)
        .map((doc) => doc.invoice_date.slice(0, 7))
    )
  ).sort();
}
