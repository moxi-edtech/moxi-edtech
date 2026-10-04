export type FiscalDocStatus = "EMITIDO" | "RETIFICADO" | "ANULADO";
export type TipoDocumento =
  | "FR"
  | "FT"
  | "NC"
  | "ND"
  | "RC"
  | "RE"
  | "PP"
  | "GR"
  | "GT"
  | "FG"
  | "GF";

export type AgtSubmissionStatus =
  | "prepared"
  | "submitting"
  | "submitted"
  | "processing"
  | "accepted"
  | "partial"
  | "rejected"
  | "cancelled"
  | "uncertain"
  | "mapping_error";

export interface FiscalDoc {
  id: string;
  numero: string;
  emitido_em: string;
  cliente_nome: string;
  total_aoa: number;
  hash_control: string;
  key_version: string;
  status: FiscalDocStatus;
  tipo_documento?: TipoDocumento;
  documento_origem_id?: string | null;
  rectifica_documento_id?: string | null;
  agt_document_status?: "N" | "C";
  agt_rejected_document_id?: string | null;
  agt_submission_status?: AgtSubmissionStatus | null;
  agt_validation_status?: "pending" | "valid" | "invalid" | null;
  agt_request_id?: string | null;
  agt_error_code?: string | null;
  agt_dead_lettered?: boolean;
}

export interface ComplianceStatus {
  status: "ok" | "error";
  kms_online: boolean;
  serie_activa: boolean;
  message?: string;
}

export interface EmissaoPayload {
  ano_fiscal: number;
  tipo_documento: TipoDocumento;
  cliente_nome: string;
  payment_mechanism?: "NU" | "TB" | "CC" | "MB";
  documento_origem_id?: string;
  rectifica_documento_id?: string;
  itens: { descricao: string; valor: number }[];
}
