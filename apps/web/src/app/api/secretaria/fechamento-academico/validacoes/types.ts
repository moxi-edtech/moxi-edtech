export type SeveridadeValidacao = "CRITICAL" | "WARN";

export type PendenciaFechamento = {
  id: string;
  regra:
    | "NOTAS_PENDENTES"
    | "FREQUENCIAS_PENDENTES"
    | "PAUTA_NAO_EMITIDA"
    | "MATRICULA_INCONSISTENTE"
    | "SNAPSHOT_LEGAL_CONFLITO";
  severidade: SeveridadeValidacao;
  turma_id?: string;
  matricula_id?: string;
  aluno_id?: string;
  mensagem: string;
  detalhe?: Record<string, unknown>;
  pode_excecao: boolean;
};

export type RelatorioSanidadeFechamento = {
  ok: boolean;
  acao: "fechar_trimestre" | "fechar_ano";
  escola_id: string;
  ano_letivo_id: string;
  periodo_letivo_id?: string;
  pendencias: PendenciaFechamento[];
  summary: {
    total: number;
    critical: number;
    warn: number;
    turmas_afetadas: number;
    matriculas_afetadas: number;
  };
};
