import type { Json } from "./supabase";

export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  profile_id?: string;
  // campos escolares que podem vir no CSV (valores crus como texto)
  curso_codigo?: string;
  classe_numero?: string;
  turno_codigo?: string;
  turma_letra?: string;
  ano_letivo?: string;
  numero_matricula?: string;
  [key: string]: string | undefined;
}

export interface AlunoStagingRecord {
  import_id: string;
  escola_id: string;

  // login/acesso (quase sempre vazio para alunos importados)
  profile_id?: string;

  // dados civis
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;

  // dados escolares para ajudar na matrícula em massa
  curso_codigo?: string;      // Ex.: EMG, CTI, EF1, EF2
  classe_numero?: number;     // Ex.: 1, 7, 10, 11, 12
  turno_codigo?: string;      // Ex.: M, T, N
  turma_letra?: string;       // Ex.: A, B, AB, ABNG
  ano_letivo?: number;        // Ex.: 2025
  numero_matricula?: string;  // Opcional; pode ser gerado

  raw_data?: Json;
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

export interface MappedColumns {
  [key: string]: string | undefined;
  // Dados pessoais
  nome?: string;
  bi?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;

  // Matrícula – colunas do CSV que mapeiam para os campos do staging
  curso_codigo?: string;
  classe_numero?: string;
  turno_codigo?: string;
  turma_letra?: string;
  ano_letivo?: string;      // aceitamos "2025" ou "2025-2026" (normaliza p/ 2025)
  numero_matricula?: string;

  // Opcional avançado
  profile_id?: string;
}
