import type { PostFiscalDocumentoInput } from "@/lib/schemas/fiscal-documento.schema";

export type CertificationPoint =
  | "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07" | "P08" | "P09"
  | "P10" | "P11" | "P12" | "P13" | "P14" | "P15" | "P16" | "P17";

export type CertificationPointStatus =
  | "planned"
  | "executed"
  | "reused"
  | "na"
  | "blocked"
  | "uncertain"
  | "failed"
  | "validated";

export type CertificationDocumentRef = {
  role: string;
  documentoId: string;
  numero: string;
  tipoDocumento: string;
  pdf?: {
    path: string;
    sha256: string;
    variant: "current" | "before-annulment" | "after-annulment";
  }[];
};

export type CertificationPointEntry = {
  point: CertificationPoint;
  title: string;
  status: CertificationPointStatus;
  scenarioCode: string;
  dependsOn?: CertificationPoint[];
  documents: CertificationDocumentRef[];
  agtSubmission?: Record<string, unknown> | null;
  blockers: string[];
  error?: {
    code: string;
    message: string;
  } | null;
  metadata?: Record<string, unknown>;
};

export type CertificationManifest = {
  schemaVersion: 1;
  officeReference: "0000498/01180000/AGT/2026";
  runId: string;
  empresaId: string;
  createdAt: string;
  updatedAt: string;
  mode: "dry-run" | "execute";
  agtEnvironment: "hml";
  externalBlockers: string[];
  points: Record<CertificationPoint, CertificationPointEntry>;
};

export type FiscalIssueRequest = PostFiscalDocumentoInput;

export type IssueSuccess = {
  documentoId: string;
  numero: string;
  tipoDocumento: string;
  agtSubmission?: Record<string, unknown> | null;
};

export type TransportOutcome<T> =
  | { kind: "success"; data: T }
  | { kind: "rejected"; code: string; message: string; httpStatus?: number }
  | { kind: "uncertain"; code: string; message: string; httpStatus?: number };

export type CertificationPreflight = {
  ok: boolean;
  blockers: string[];
};

export interface CertificationTransport {
  preflight(input: { empresaId: string; year: number }): Promise<CertificationPreflight>;
  issue(request: FiscalIssueRequest): Promise<TransportOutcome<IssueSuccess>>;
  annul(input: {
    documentoId: string;
    motivo: string;
    metadata?: Record<string, unknown>;
  }): Promise<TransportOutcome<{ documentoId: string }>>;
  capturePdf(input: {
    documentoId: string;
    fileName: string;
    variant: "current" | "before-annulment" | "after-annulment";
  }): Promise<TransportOutcome<{ path: string; sha256: string }>>;
  issueReceipt?(input: {
    paymentId: string;
    idempotencyKey: string;
  }): Promise<TransportOutcome<IssueSuccess>>;
}

export type CertificationRunnerOptions = {
  runId: string;
  empresaId: string;
  year: number;
  execute: boolean;
  ack?: string | null;
  now?: Date;
  transport?: CertificationTransport;
  rcPaymentId?: string | null;
};
