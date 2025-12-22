export interface ImportAlunoDTO {
  nome: string;
  numero_processo: string | null;
  data_nascimento: string; // YYYY-MM-DD
  genero: "M" | "F";
  bi_numero: string | null;
  nif: string | null;
  encarregado_nome: string | null;
  encarregado_telefone: string | null;
  encarregado_email: string | null;
  turma_codigo: string | null;
}

export interface ImportResult {
  sucesso: number;
  erros_count: number;
  mensagens_erro: string[];
}

