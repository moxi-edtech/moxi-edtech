import type { Json } from "./supabase";

export type ImportStatus = "uploaded" | "validando" | "validado" | "imported" | "failed";

export interface AlunoCSV {
  // Template v2.0 (headers do Excel)
  NOME_COMPLETO?: string | number;
  NUMERO_PROCESSO?: string | number;
  DATA_NASCIMENTO?: string | number;
  GENERO?: string;
  BI_NUMERO?: string | number;
  NIF?: string | number;
  NOME_ENCARREGADO?: string;
  TELEFONE_ENCARREGADO?: string | number;
  EMAIL_ENCARREGADO?: string;
  TURMA_CODIGO?: string;

  // Legado / compatibilidade
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
  curso_codigo?: string;
  classe_numero?: string;
  turno_codigo?: string;
  turma_letra?: string;
  ano_letivo?: string;
  numero_matricula?: string;
  [key: string]: string | number | undefined;
}

export interface AlunoStagingRecord {
  import_id: string;
  escola_id: string;
  row_number?: number;

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
  sexo?: string; // Gênero (M/F)
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
  cursos_created?: number; // Cursos pendentes/gerados
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
  sexo?: string;
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
  }
