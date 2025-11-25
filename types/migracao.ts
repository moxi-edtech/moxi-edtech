export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  email?: string;
  profile_id?: string;
  // novos campos “escolares” que podem vir no CSV
  classe_label?: string;
  turma_label?: string;
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
  classe_label?: string;
  turma_label?: string;
  ano_letivo?: string;
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

export interface MappedColumns {
  // Dados pessoais
  nome?: string;
  bi?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;

  // Matrícula – formato flexível
  curso_codigo?: string;   // continua igual: EMG, CTI, etc.
  classe_label?: string;   // agora: "1ª classe", "7ª classe", "10ª classe"...
  turno_codigo?: string;   // M / T / N (podemos aceitar texto tipo "Manhã" e normalizar depois)
  turma_label?: string;    // "A", "AB", "ABNG", "Turma 1"...
  ano_letivo?: string;     // "2025" ou "2025-2026"

  // Opcional avançado
  profile_id?: string;
}