export interface GrupoMatriculaAluno {
  id: number; // id do staging_alunos
  nome?: string;
  data_nascimento?: string;
  profile_id?: string;
  numero_matricula?: string;
  aluno_id?: string; // id do aluno em public.alunos (se já existir)
}

export interface GrupoMatricula {
  // Identidade do grupo (chave para a função e para o componente)
  import_id: string;
  escola_id: string;

  // Dimensões de matrícula vindas do CSV / staging
  curso_codigo?: string | null;   // EMG, CTI, etc
  classe_numero?: string | null;  // "7", "8", "10", etc
  turno_codigo?: string | null;   // "M", "T", "N"
  turma_letra?: string | null;    // "A", "B", "AB", "ABNG", etc
  ano_letivo?: number | null;     // 2025 ou 2025-2026 (se for texto, pode virar string aqui)

  // Quantidade e lista de alunos
  count: number;
  alunos: GrupoMatriculaAluno[];
}

export interface MatriculaMassaPayload {
  import_id: string;
  escola_id: string;

  curso_codigo: string;
  classe_numero: string;
  turno_codigo: string;
  turma_letra: string;
  ano_letivo: number;

  turma_id: string; // id da turma alvo
}