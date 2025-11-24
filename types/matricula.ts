export interface GrupoMatriculaAluno {
  id: number | string;
  nome?: string;
  data_nascimento?: string;
  profile_id?: string;
  numero_matricula?: string;
}

export interface GrupoMatricula {
  classe_label: string;
  turma_label: string;
  ano_letivo: number;
  count: number;
  alunos: GrupoMatriculaAluno[];
}

export interface MatriculaMassaPayload {
  import_id: string;
  escola_id: string;
  classe_label: string;
  turma_label: string;
  ano_letivo: number;
  turma_id: string;
}
