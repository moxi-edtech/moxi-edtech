import type { Json } from "./supabase";

export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  nome?: string;
  data_nascimento?: string;
  telefone?: string;
  bi?: string;
  bi_numero?: string;
  nif?: string;
  email?: string;
  encarregado_nome?: string;
  encarregado_telefone?: string;
  encarregado_email?: string;
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
  bi_numero?: string;
  nif?: string;
  email?: string;
  encarregado_nome?: string;
  encarregado_telefone?: string; // NOVO: Telefone do Encarregado
  encarregado_email?: string;    // NOVO: Email do Encarregado
  numero_processo?: string; // NOVO: Número de Processo (opcional)

  // dados escolares para ajudar na matrícula em massa
  turma_codigo?: string;      // NOVO: Código da Turma (ex: "10-A")
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
  skipped?: number;
  errors: number;
  warnings_turma?: number;
  turmas_created?: number; // Turmas criadas automaticamente (rascunho)
}

export interface MappedColumns {
  [key: string]: string | undefined;
  // Dados pessoais
  nome?: string;
  bi?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  encarregado_nome?: string;
  encarregado_telefone?: string; // NOVO: Telefone do Encarregado
  numero_processo?: string; // NOVO: Número de Processo

  // Matrícula – colunas do CSV que mapeiam para os campos do staging
  turma_codigo?: string;      // NOVO: Código da Turma
  ano_letivo?: string;
  numero_matricula?: string;

  // Documentos
  bi_numero?: string;
  nif?: string;
  encarregado_email?: string;

  // Opcional avançado
  profile_id?: string;
