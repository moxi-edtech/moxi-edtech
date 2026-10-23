/** Choose one canonical person interaction. The server still authorizes every read. */
export type PersonSelection = "context" | "student-modal" | "navigate";
export type OperatorPortal = "secretaria" | "operacoes" | "admin";

export function isCommandCenterOperatorPortal(portal: string | undefined): portal is OperatorPortal {
  return portal === "secretaria" || portal === "operacoes" || portal === "admin";
}

const contextualTypes = new Set(["curso", "classe", "turma", "professor", "disciplina"]);

export function resolveCommandCenterSelection(
  type: string,
  portal: string | undefined,
  options: { hasSchoolScope: boolean; hasStudentModal: boolean },
): PersonSelection {
  if (!options.hasSchoolScope || !isCommandCenterOperatorPortal(portal)) return "navigate";
  if (type === "aluno" && options.hasStudentModal) return "student-modal";
  if (contextualTypes.has(type)) return "context";
  return "navigate";
}
