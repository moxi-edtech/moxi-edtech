import type { RaaProgressionDecision } from "@/lib/academico/raa-progression";

export type RematriculaAcademicEligibilityCode =
  | "ACADEMIC_APPROVED"
  | "ACADEMIC_RESULT_PENDING"
  | "ACADEMIC_NOT_APPROVED"
  | "ACADEMIC_CYCLE_COMPLETED";

export type RematriculaAcademicEligibility = {
  eligible: boolean;
  code: RematriculaAcademicEligibilityCode;
  reason: string;
};

export function classifyRematriculaAcademicEligibility(
  decision: RaaProgressionDecision | null | undefined,
): RematriculaAcademicEligibility {
  if (decision === "transitou") {
    return {
      eligible: true,
      code: "ACADEMIC_APPROVED",
      reason: "Resultado académico fechado como aprovado; a rematrícula pode avançar.",
    };
  }

  if (!decision || decision === "pendente") {
    return {
      eligible: false,
      code: "ACADEMIC_RESULT_PENDING",
      reason: "As notas e o resultado académico precisam estar fechados antes da rematrícula.",
    };
  }

  if (decision === "concluiu") {
    return {
      eligible: false,
      code: "ACADEMIC_CYCLE_COMPLETED",
      reason: "O ciclo académico foi concluído; este aluno não segue pelo fluxo de rematrícula.",
    };
  }

  return {
    eligible: false,
    code: "ACADEMIC_NOT_APPROVED",
    reason: "A rematrícula exige resultado académico aprovado.",
  };
}

export function canStartRematricula(input: {
  academicDecision: RaaProgressionDecision | null | undefined;
  debtTotal: number;
}) {
  const academic = classifyRematriculaAcademicEligibility(input.academicDecision);
  if (!academic.eligible) return { ok: false as const, academic };

  if (Number(input.debtTotal) > 0) {
    return {
      ok: false as const,
      academic,
      financial: {
        code: "REMATRICULA_DEBT_REQUIRED" as const,
        reason: "Regularize as mensalidades vencidas antes de rematricular.",
      },
    };
  }

  return { ok: true as const, academic };
}
