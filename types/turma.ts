export interface Turma {
  id: string;
  nome: string;
  ano_letivo?: number | string;
  anoLetivo?: number | string;
  classe?: {
    nome: string;
  };
}
