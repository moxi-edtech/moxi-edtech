import {
  gradePeriodState,
  type GradePeriodRow,
  type GradePeriodState,
} from "@/lib/academico/grade-period-context";

export type GradeEntryAvailability = {
  state: GradePeriodState;
  canWrite: boolean;
  canRequestReopen: boolean;
  explanation: string;
};

export function resolveGradeEntryAvailability(options: {
  periods: ReadonlyArray<GradePeriodRow>;
  trimestre: number;
  academicMode: "CURRENT" | "HISTORICAL_READ";
  turmaStatusFecho: string | null;
  gradeMaxima: number | null;
  activeReopening: boolean;
  now?: Date;
}): GradeEntryAvailability {
  const period = options.periods.find((item) => item.numero === options.trimestre);
  const state = period ? gradePeriodState(period, options.now ?? new Date(), "Africa/Luanda") : "unconfigured";
  if (options.academicMode !== "CURRENT") {
    return { state, canWrite: false, canRequestReopen: false,
      explanation: "Este ano letivo é histórico. A pauta está disponível apenas para consulta." };
  }
  if (options.gradeMaxima === null) {
    return { state, canWrite: false, canRequestReopen: false,
      explanation: "A escala de avaliação desta turma não permite lançamentos numéricos nesta pauta." };
  }
  if (state === "unconfigured") {
    return { state, canWrite: false, canRequestReopen: false,
      explanation: "O trimestre ainda não está configurado no calendário oficial." };
  }
  if (state === "future") {
    return { state, canWrite: false, canRequestReopen: false,
      explanation: "O trimestre ainda não começou. As notas ficam disponíveis na data oficial." };
  }
  const turmaFechada = options.turmaStatusFecho != null && options.turmaStatusFecho !== "ABERTO";
  const afterWindow = state === "past" || state === "locked";
  if (turmaFechada || afterWindow) {
    if (options.activeReopening) return {
      state, canWrite: true, canRequestReopen: false,
      explanation: "Reabertura autorizada para esta turma, disciplina e trimestre. Confirma o prazo na pauta.",
    };
    return {
      state, canWrite: false, canRequestReopen: true,
      explanation: turmaFechada ? "Esta turma está encerrada para lançamentos. Solicita reabertura à escola."
        : state === "locked" ? "O prazo de lançamento terminou. Solicita reabertura à escola."
        : "O trimestre terminou. Solicita reabertura à escola para corrigir notas.",
    };
  }
  return { state, canWrite: true, canRequestReopen: false,
    explanation: "O trimestre está disponível para lançamento de notas." };
}
