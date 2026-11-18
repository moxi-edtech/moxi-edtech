/**
 * Only reasons emitted by the CURTUME 2025/2026 legal-close RPC.
 * These are operational next steps, not academic decisions.
 */
export type HistoricBatchIssueAdvice = {
  title: string;
  nextStep: string;
};

const REASONS: Record<string, HistoricBatchIssueAdvice> = {
  ORIGEM_HISTORICA_INCOMPATIVEL: {
    title: "Vínculo da matrícula de origem inválido",
    nextStep: "Conferir o documento e regularizar a origem de 2025/2026 neste painel.",
  },
  NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO: {
    title: "Notas em conflito",
    nextStep: "Comparar as notas operacionais com a pauta e assinar a conferência sem apagar lançamentos.",
  },
  SEM_NOTAS_HISTORICAS: {
    title: "Pauta sem notas",
    nextStep: "Transcrever apenas as notas comprovadas pela pauta de 2025/2026.",
  },
  PAUTA_HISTORICA_INCONSISTENTE: {
    title: "Dados da pauta por rever",
    nextStep: "Conferir a classificação e a referência da pauta importada.",
  },
  DISCIPLINA_DUPLICADA_NA_PAUTA: {
    title: "Disciplina repetida",
    nextStep: "Rever os lançamentos duplicados na pauta histórica.",
  },
  SEM_DIAGNOSTICO: {
    title: "Aguardando diagnóstico do fecho",
    nextStep: "Execute «Reanalisar os pendentes» para obter a causa real da rejeição.",
  },
  RAA_RESULTADO_NAO_RECONHECIDO: {
    title: "Resultado académico por rever",
    nextStep: "Conferir a decisão com a regra de progressão e ratificar pelo fluxo académico; não alterar notas automaticamente.",
  },
};

/** Distinguish real academic exceptions from transient/unknown server failures. */
export function isHistoricBatchAcademicIssue(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(REASONS, code);
}

export function getHistoricBatchIssueAdvice(code: string): HistoricBatchIssueAdvice {
  return REASONS[code] ?? {
    title: "Validação do fecho não concluída",
    nextStep: "Consulte o código devolvido pela RPC e reanalise este caso antes de repetir a operação.",
  };
}
