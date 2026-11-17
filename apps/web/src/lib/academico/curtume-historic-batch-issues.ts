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
    title: "Matrícula de origem por rever",
    nextStep: "Verificar a classe, o ano e o resultado da matrícula de 2025/2026.",
  },
  NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO: {
    title: "Notas em conflito",
    nextStep: "Conferir as notas já lançadas com a pauta antes do fecho.",
  },
  SEM_NOTAS_HISTORICAS: {
    title: "Pauta sem notas",
    nextStep: "Completar as classificações do ano anterior.",
  },
  PAUTA_HISTORICA_INCONSISTENTE: {
    title: "Dados da pauta por rever",
    nextStep: "Conferir a classificação e a referência da pauta importada.",
  },
  DISCIPLINA_DUPLICADA_NA_PAUTA: {
    title: "Disciplina repetida",
    nextStep: "Rever os lançamentos duplicados na pauta histórica.",
  },
  RAA_RESULTADO_NAO_RECONHECIDO: {
    title: "Resultado académico por rever",
    nextStep: "Conferir a decisão final do aluno com a pauta e as regras académicas.",
  },
};

export function getHistoricBatchIssueAdvice(code: string): HistoricBatchIssueAdvice {
  return REASONS[code] ?? {
    title: "Revisão académica necessária",
    nextStep: "Conferir a situação do aluno no Balcão antes de repetir o fecho.",
  };
}
