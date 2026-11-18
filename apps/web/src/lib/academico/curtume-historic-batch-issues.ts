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
  ACADEMIC_TRANSITION_LINK_REQUIRED: {
    title: "Vínculo entre anos incompatível",
    nextStep: "Conferir a matrícula de destino e o vínculo com a matrícula de origem, sem criar outro aluno ou histórico.",
  },
  ACADEMIC_DESTINATION_CONFLICT: {
    title: "Classe de destino incompatível",
    nextStep: "Corrigir a classe de 2026/2027 com a prévia de impacto e a pauta comprovada antes de reanalisar o fecho.",
  },
  ACADEMIC_DECISION_EVIDENCE_REQUIRED: {
    title: "Decisão escolar sem evidência",
    nextStep: "Ratificar o resultado de 2025/2026 com uma referência documental válida no próprio processo.",
  },
  ACADEMIC_HISTORY_NOT_FINAL: {
    title: "Ano de origem ainda não validado",
    nextStep: "Rever o vínculo ao ano e o estado académico da matrícula anterior.",
  },
  ACADEMIC_RESULT_NOT_VERIFIED: {
    title: "Resultado anual não verificado",
    nextStep: "Conferir a pauta e a decisão oficial antes de fechar o histórico.",
  },
  RATIFICATION_COHORT_REQUIRED: {
    title: "Origem sem coorte autorizada",
    nextStep: "Validar a inclusão escolar de 2025/2026 no percurso académico com a Direção.",
  },
  HISTORICAL_RATIFICATION_REQUIRED: {
    title: "Falta ratificação da pauta",
    nextStep: "Confirmar a referência documental e ratificar o resultado pela Direção.",
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
