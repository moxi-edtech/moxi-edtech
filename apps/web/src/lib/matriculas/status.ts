export const ACTIVE_MATRICULA_STATUSES = ['ativo', 'ativa', 'active'] as const

export type ActiveMatriculaStatus = (typeof ACTIVE_MATRICULA_STATUSES)[number]

export const isActiveMatriculaStatus = (status?: string | null) => {
  const normalized = String(status || '').trim().toLowerCase()
  return (ACTIVE_MATRICULA_STATUSES as readonly string[]).includes(normalized)
}

// Canonical contract: use `matriculas.ativo = true` as source of truth.
// The status list exists for backward compatibility in read paths.
