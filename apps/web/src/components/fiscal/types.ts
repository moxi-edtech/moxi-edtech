export type FiscalDocStatus = "EMITIDO" | "RETIFICADO" | "ANULADO";
export type TipoDocumento = "FT" | "FR";

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
  itens: { descricao: string; valor: number }[];
}
