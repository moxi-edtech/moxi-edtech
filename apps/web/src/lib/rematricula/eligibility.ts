import type {
  RaaProgressionDecision,
  RaaProgressionResult,
} from "@/lib/academico/raa-progression";

export type RematriculaAcademicEligibilityCode =
  | "ACADEMIC_READY"
  | "ACADEMIC_CONDITIONAL"
  | "ACADEMIC_RESULT_PENDING"
  | "ACADEMIC_REVIEW_REQUIRED"
  | "ACADEMIC_CONDITIONAL_BLOCKED"
  | "ACADEMIC_NOT_APPROVED"
  | "ACADEMIC_CYCLE_COMPLETED";

export type RematriculaAcademicMode = "regular" | "conditional";

export type RematriculaAcademicEligibility = {
  eligible: boolean;
  code: RematriculaAcademicEligibilityCode;
  mode: RematriculaAcademicMode | null;
  reason: string;
  disciplinaIdsPendentes: string[];
};

export type RematriculaAcademicInput = {
  decision: RaaProgressionDecision | null | undefined;
  destino?: RaaProgressionResult["destino"] | null;
  efetivacaoMatriculaBloqueada?: boolean | null;
  disciplinaIdsPendentes?: string[] | null;
};

export function classifyRematriculaAcademicEligibility(
  input: RematriculaAcademicInput | RaaProgressionDecision | null | undefined,
): RematriculaAcademicEligibility {
  const normalized: RematriculaAcademicInput =
    typeof input === "string" || input == null
      ? { decision: input ?? null }
      : input;

  const {
    decision,
    destino = null,
    efetivacaoMatriculaBloqueada = false,
    disciplinaIdsPendentes,
  } = normalized;
  const pendingDisciplineIds = disciplinaIdsPendentes ?? [];

  if (decision === "transitou") {
    return {
      eligible: true,
      code: "ACADEMIC_READY",
      mode: "regular",
      reason: "O RAA autorizou a progressão para a etapa seguinte.",
      disciplinaIdsPendentes: pendingDisciplineIds,
    };
  }

  if (decision === "inscricao_condicional") {
    if (destino !== "proxima_etapa" || efetivacaoMatriculaBloqueada) {
      return {
        eligible: false,
        code: "ACADEMIC_CONDITIONAL_BLOCKED",
        mode: "conditional",
        reason:
          "O RAA reconhece inscrição condicional, mas a efetivação da matrícula ainda depende da resolução académica indicada.",
        disciplinaIdsPendentes: pendingDisciplineIds,
      };
    }

    return {
      eligible: true,
      code: "ACADEMIC_CONDITIONAL",
      mode: "conditional",
      reason:
        "O RAA autorizou a progressão condicional para a etapa seguinte; as disciplinas pendentes continuam rastreadas.",
      disciplinaIdsPendentes: pendingDisciplineIds,
    };
  }

  if (!decision || decision === "pendente") {
    return {
      eligible: false,
      code: "ACADEMIC_RESULT_PENDING",
      mode: null,
      reason:
        "As notas e os dados académicos precisam estar completos antes da rematrícula.",
      disciplinaIdsPendentes: pendingDisciplineIds,
    };
  }

  if (decision === "recurso") {
    return {
      eligible: false,
      code: "ACADEMIC_REVIEW_REQUIRED",
      mode: null,
      reason:
        "Existem disciplinas em recurso. Conclua ou acompanhe o recurso antes de efetivar a rematrícula.",
      disciplinaIdsPendentes: pendingDisciplineIds,
    };
  }

  if (decision === "concluiu") {
    return {
      eligible: false,
      code: "ACADEMIC_CYCLE_COMPLETED",
      mode: null,
      reason:
        "O ciclo académico foi concluído; este aluno não segue pelo fluxo de rematrícula.",
      disciplinaIdsPendentes: pendingDisciplineIds,
    };
  }

  return {
    eligible: false,
    code: "ACADEMIC_NOT_APPROVED",
    mode: null,
    reason:
      "A decisão RAA vigente não autoriza progressão para a etapa seguinte.",
    disciplinaIdsPendentes: pendingDisciplineIds,
  };
}

export function canStartRematricula(input: {
  academic: RematriculaAcademicInput;
  debtTotal: number;
}) {
  const academic = classifyRematriculaAcademicEligibility(input.academic);
  if (!academic.eligible) return { ok: false as const, academic };

  if (Number(input.debtTotal) > 0) {
    return {
      ok: false as const,
      academic,
      financial: {
        code: "REMATRICULA_DEBT_REQUIRED" as const,
        reason: "Regularize todos os saldos em aberto antes de rematricular.",
      },
    };
  }

  return { ok: true as const, academic };
}
