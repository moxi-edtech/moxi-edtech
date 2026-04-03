export type FiscalDocStatus = "EMITIDO" | "RETIFICADO" | "ANULADO";
export type TipoDocumento = "FR" | "FT" | "NC" | "ND" | "RC" | "PP" | "GR" | "GT" | "FG";

export interface FiscalDoc {
  id: string;
  numero: string;
  emitido_em: string;
  cliente_nome: string;
  total_aoa: number;
  hash_control: string;
  key_version: string;
  status: FiscalDocStatus;
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
