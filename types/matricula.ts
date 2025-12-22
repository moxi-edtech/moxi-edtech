export interface GrupoMatriculaAluno {
  id: number;          // id do staging_alunos
  nome?: string;
  data_nascimento?: string;
  profile_id?: string;
  numero_matricula?: string;
}

export interface GrupoMatricula {
  import_id: string;
  escola_id: string;

  turma_codigo?: string | null;
  ano_letivo?: number | null;

  count: number;
  alunos: GrupoMatriculaAluno[];
}

export interface MatriculaMassaPayload {
  import_id: string;
  escola_id: string;
  turma_code?: string;
  ano_letivo?: number;
  turma_id: string;
}
