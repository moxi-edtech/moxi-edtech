import { INTELLIGENCE_INTENTS, type IntelligenceIntent } from "./school-intelligence-contract";

/** A deployment switch is never evidence of safety: both independent proofs must pass. */
export type IntelligenceActivation = {
  requested: boolean;
  sourceProven: boolean;
  isolationProven: boolean;
};

const flagNames: Record<IntelligenceIntent, string> = {
  teacher_grade_deadlines: "KLASSE_AI_TEACHER_GRADE_DEADLINES",
  teacher_pending_details: "KLASSE_AI_TEACHER_PENDING_DETAILS",
  students_without_subject_grades: "KLASSE_AI_STUDENTS_WITHOUT_SUBJECT_GRADES",
  monthly_absences: "KLASSE_AI_MONTHLY_ABSENCES",
  pending_enrollments: "KLASSE_AI_PENDING_ENROLLMENTS",
  available_class_seats: "KLASSE_AI_AVAILABLE_CLASS_SEATS",
  monthly_finance: "KLASSE_AI_MONTHLY_FINANCE",
  aged_tuitions: "KLASSE_AI_AGED_TUITIONS",
  missing_documents: "KLASSE_AI_MISSING_DOCUMENTS",
  official_failure_risk: "KLASSE_AI_OFFICIAL_FAILURE_RISK",
};

export function activationForIntent(intent: IntelligenceIntent, env: Record<string, string | undefined> = process.env): IntelligenceActivation {
  const key = flagNames[intent];
  return {
    requested: env[key] === "true",
    sourceProven: env[`${key}_SOURCE_PROVEN`] === "true",
    isolationProven: env[`${key}_ISOLATION_PROVEN`] === "true",
  };
}

export function isIntelligenceActive(intent: IntelligenceIntent, env: Record<string, string | undefined> = process.env): boolean {
  const activation = activationForIntent(intent, env);
  return activation.requested && activation.sourceProven && activation.isolationProven;
}

export function disabledIntelligenceReason(intent: IntelligenceIntent, env: Record<string, string | undefined> = process.env): string | null {
  const activation = activationForIntent(intent, env);
  if (isIntelligenceActive(intent, env)) return null;
  const missing = [
    !activation.requested && "ativação não autorizada",
    !activation.sourceProven && "fonte canónica não comprovada por testes",
    !activation.isolationProven && "isolamento de escola, polo e papel não comprovado por testes",
  ].filter(Boolean);
  return `Esta consulta está desativada por segurança: ${missing.join("; ")}. Nenhum resultado foi estimado.`;
}

export const INTELLIGENCE_FLAG_NAMES: Readonly<Record<IntelligenceIntent, string>> = flagNames;
export const ALL_INTELLIGENCE_FLAGS = INTELLIGENCE_INTENTS.map((intent) => flagNames[intent]);
