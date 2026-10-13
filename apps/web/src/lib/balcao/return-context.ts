import type { BalcaoActionId } from "./action-registry";

// Aluno suspenso durante uma nova matrícula, distinto do aluno-alvo da inscrição.
export const RETURN_STUDENT_PARAM = "atendimentoAlunoId";

export function readBalcaoStudentId(params: URLSearchParams, action: BalcaoActionId): string | null {
  return params.get(action === "enrollment" ? RETURN_STUDENT_PARAM : "alunoId");
}

export function setBalcaoLocationContext(
  current: URLSearchParams,
  studentId: string | null,
  action: BalcaoActionId,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (action === "enrollment") {
    next.delete("alunoId");
    if (studentId) next.set(RETURN_STUDENT_PARAM, studentId);
    else next.delete(RETURN_STUDENT_PARAM);
  } else {
    next.delete(RETURN_STUDENT_PARAM);
    if (studentId) next.set("alunoId", studentId);
    else next.delete("alunoId");
  }
  if (action === "desk") next.delete("action");
  else next.set("action", action);
  return next;
}
