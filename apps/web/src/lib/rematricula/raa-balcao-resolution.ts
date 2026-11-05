import type { RematriculaCardState } from "@/hooks/useRematriculaBalcao";

export type RaaBalcaoAction = "nota" | "reapreciacao" | "justificacao" | "disciplina" | "documentos" | "rever_resultado";
export type RaaBalcaoPlan = {
  titulo: string;
  detalhe: string;
  acao: RaaBalcaoAction;
  permiteRematricula: false;
};

/** Only the server's canonical RAA result can authorize a new matrícula. */
const BLOCKED: Partial<Record<RematriculaCardState, RaaBalcaoPlan>> = {
  ACADEMIC_PENDING: {
    titulo: "Notas ou dados académicos pendentes",
    detalhe: "Verifique as notas em falta na pauta.",
    acao: "nota", permiteRematricula: false,
  },
  ACADEMIC_REVIEW_REQUIRED: {
    titulo: "Exame ou recurso pendente",
    detalhe: "Consulte o exame, o pedido e o resultado publicado.",
    acao: "reapreciacao", permiteRematricula: false,
  },
  ACADEMIC_CONDITIONAL_BLOCKED: {
    titulo: "Inscrição condicional ainda bloqueada",
    detalhe: "Conclua o exame ou o recurso pendente.",
    acao: "reapreciacao", permiteRematricula: false,
  },
  ACADEMIC_ATTENDANCE_REVIEW_REQUIRED: {
    titulo: "Retenção por faltas",
    detalhe: "Analise as faltas e justificações.",
    acao: "justificacao", permiteRematricula: false,
  },
  ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED: {
    titulo: "Retenção por indisciplina",
    detalhe: "Reveja a ocorrência e registe a decisão autorizada.",
    acao: "disciplina", permiteRematricula: false,
  },
  ACADEMIC_NOT_APPROVED: {
    titulo: "Resultado académico não autoriza progressão",
    detalhe: "Consulte o resultado e as pendências académicas.",
    acao: "rever_resultado", permiteRematricula: false,
  },
  ACADEMIC_CYCLE_COMPLETED: {
    titulo: "Ciclo de ensino concluído",
    detalhe: "Consulte e emita os documentos de conclusão.",
    acao: "documentos", permiteRematricula: false,
  },
};
export function raaBalcaoPlan(status: RematriculaCardState | "CHECKING" | null): RaaBalcaoPlan | null {
  return status ? BLOCKED[status as RematriculaCardState] ?? null : null;
}

/**
 * Keep the academic and payment axes independent. A paid order can be pending
 * destination reconciliation while the *origin* still needs grades, appeals
 * or attendance decisions. The server's eligibility remains authoritative.
 *
 * This is presentation-only: the returned status is NEVER persisted and
 * cannot authorize an enrollment, invoice, exam or grade write.
 */
const ACADEMIC_REASON_STATUS: Readonly<Record<string, RematriculaCardState>> = {
  ACADEMIC_RESULT_PENDING: "ACADEMIC_PENDING",
  ACADEMIC_PENDING: "ACADEMIC_PENDING",
  ACADEMIC_REVIEW_REQUIRED: "ACADEMIC_REVIEW_REQUIRED",
  ACADEMIC_CONDITIONAL_BLOCKED: "ACADEMIC_CONDITIONAL_BLOCKED",
  ACADEMIC_ATTENDANCE_REVIEW_REQUIRED: "ACADEMIC_ATTENDANCE_REVIEW_REQUIRED",
  ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED: "ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED",
  ACADEMIC_CYCLE_COMPLETED: "ACADEMIC_CYCLE_COMPLETED",
  ACADEMIC_NOT_APPROVED: "ACADEMIC_NOT_APPROVED",
};

export function raaBalcaoEffectiveStatus(
  operationalStatus: RematriculaCardState | "CHECKING" | null,
  academic: { eligible?: boolean; code?: string | null } | null | undefined,
): RematriculaCardState | "CHECKING" | null {
  // An already completed enrollment must never acquire a second action from
  // the origin's historical verdict. An existing destination is also not a
  // pretext to generate a duplicate rematrícula.
  if (operationalStatus === "ALREADY_COMPLETED" ||
      operationalStatus === "DESTINATION_ENROLLED" ||
      academic?.eligible !== false) return operationalStatus;
  const verified = academic.code && ACADEMIC_REASON_STATUS[academic.code];
  return verified || operationalStatus;
}
