export type TeacherWorkloadDraft = {
  unidade: "tempos" | "minutos"
  limite: string
  contratual: string
}

export type TeacherWorkloadPayload = {
  carga_lectiva_unidade: TeacherWorkloadDraft["unidade"]
  carga_lectiva_limite: number
  carga_contratual_minutos: number | null
}

export const DEFAULT_TEACHER_WORKLOAD: TeacherWorkloadDraft = {
  unidade: "tempos", limite: "20", contratual: "",
}

export function parseTeacherWorkload(draft: TeacherWorkloadDraft): TeacherWorkloadPayload {
  if (draft.unidade !== "tempos" && draft.unidade !== "minutos") {
    throw new Error("Seleccione a unidade da carga lectiva.")
  }
  const value = Number(draft.limite)
  const limit = draft.unidade === "minutos" ? Math.round(value * 60) : value
  const contract = draft.contratual.trim() === "" ? null : Math.round(Number(draft.contratual) * 60)
  if (!draft.limite.trim() || !Number.isFinite(value) || !Number.isInteger(limit) || limit <= 0 ||
      limit > (draft.unidade === "tempos" ? 100 : 10080)) {
    throw new Error("Informe um limite lectivo semanal válido.")
  }
  if (contract !== null && (!Number.isInteger(contract) || contract <= 0 || contract > 10080)) {
    throw new Error("Informe uma carga contratual semanal válida.")
  }
  if (draft.unidade === "minutos" && contract !== null && limit > contract) {
    throw new Error("O limite lectivo não pode exceder a carga contratual.")
  }
  return { carga_lectiva_unidade: draft.unidade, carga_lectiva_limite: limit, carga_contratual_minutos: contract }
}
