export interface Aluno {
  id: string;
  nome: string;
  nome_completo?: string | null;
  numero_processo?: string | null;
  bi_numero?: string | null;
}

export interface Candidatura {
  id: string;
  escola_id: string;
  aluno_id?: string | null;
  curso_id: string;
  ano_letivo: number;
  status: string;
  dados_candidato?: any;
  nome_candidato?: string | null;
  turno?: string | null;
  turma_preferencial_id?: string | null;
  classe_id?: string | null;
  alunos?: Aluno;
  cursos?: { id: string; nome: string };
}

export interface Session {
  id: string;
  nome: string;
  status?: "ativa" | string;
}

export interface Ref {
  id: string;
  nome: string;
}

export interface Curso {
  id: string;
  nome: string;
  tipo: string;
  classes: Ref[];
}

export interface Turma {
  id: string;
  nome: string;
  turno?: string;
  classe_nome?: string;
  classe?: { id: string; nome: string };
  curso_nome?: string;
  curso?: { id: string; nome: string };
  curso_global_hash?: string;
  curso_tipo?: string;
  classe_id?: string;
  curso_id?: string;
  ocupacao?: number;
  ocupacao_atual?: number;
  capacidade?: number;
  capacidade_maxima?: number;
}

export interface Orcamento {
  valor_matricula: number | null;
  valor_mensalidade: number;
  origem_regra: string;
  dia_vencimento?: number | null;
}