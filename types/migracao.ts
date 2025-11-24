export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  profile_id?: string;

  // novos para matrícula em massa
  classe?: string;
  turma?: string;
  ano_letivo?: string;
  numero_matricula?: string;

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

  // novos campos de matrícula
  classe_label?: string;
  turma_label?: string;
  ano_letivo?: number;
  numero_matricula?: string;

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

export type MappedColumns = {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  profile_id?: string;

  // mapeamento CSV ↔ campos de matrícula
  classe?: string;
  turma?: string;
  ano_letivo?: string;
  numero_matricula?: string;

  [key: string]: string | undefined;
};
