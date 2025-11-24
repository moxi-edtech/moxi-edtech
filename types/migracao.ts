export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  profile_id?: string;
  [key: string]: string | undefined;
}

export interface AlunoStagingRecord {
  import_id: string;
  escola_id: string;
  profile_id?: string;
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  raw_data?: Record<string, unknown>;
}

export interface ErroImportacao {
  row_number?: number;
  column_name?: string;
  message: string;
  raw_value?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

export type MappedColumns = Record<string, string>;
