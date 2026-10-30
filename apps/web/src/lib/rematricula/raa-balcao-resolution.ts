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
    detalhe: "Complete a pauta com a competência adequada. Não existe aprovação por omissão.",
    acao: "nota", permiteRematricula: false,
  },
  ACADEMIC_REVIEW_REQUIRED: {
    titulo: "Exame ou recurso pendente",
    detalhe: "Consulte os pedidos e decisões. A decisão do pedido não substitui a nota ou o resultado oficial.",
    acao: "reapreciacao", permiteRematricula: false,
  },
  ACADEMIC_CONDITIONAL_BLOCKED: {
    titulo: "Inscrição condicional ainda bloqueada",
    detalhe: "A progressão condicional exige conclusão do exame ou do recurso previsto no RAA.",
    acao: "reapreciacao", permiteRematricula: false,
  },
  ACADEMIC_ATTENDANCE_REVIEW_REQUIRED: {
    titulo: "Retenção por faltas",
    detalhe: "Analise as justificações comprovadas. Aprovar uma justificação não altera automaticamente a frequência nem o histórico legal.",
    acao: "justificacao", permiteRematricula: false,
  },
  ACADEMIC_DISCIPLINARY_REVIEW_REQUIRED: {
    titulo: "Retenção por indisciplina",
    detalhe: "A decisão disciplinar compete à direção; não é uma retificação livre do resultado académico.",
    acao: "disciplina", permiteRematricula: false,
  },
  ACADEMIC_NOT_APPROVED: {
    titulo: "Resultado académico não autoriza progressão",
    detalhe: "Reveja as evidências oficiais. Nenhuma decisão manual do Balcão pode substituir o RAA.",
    acao: "rever_resultado", permiteRematricula: false,
  },
  ACADEMIC_CYCLE_COMPLETED: {
    titulo: "Ciclo de ensino concluído",
    detalhe: "Não crie matrícula seguinte. Prossiga para a emissão de documentos no próprio Balcão.",
    acao: "documentos", permiteRematricula: false,
  },
};
export function raaBalcaoPlan(status: RematriculaCardState | "CHECKING" | null): RaaBalcaoPlan | null {
  return status ? BLOCKED[status as RematriculaCardState] ?? null : null;
}
