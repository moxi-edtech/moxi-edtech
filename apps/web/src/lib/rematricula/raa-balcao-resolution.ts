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
