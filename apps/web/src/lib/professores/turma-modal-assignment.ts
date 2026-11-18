import type { AssignmentCandidate } from './assignment-candidates'

export type ModalProfessor = {
  user_id?: string | null
  professor_id?: string | null
  nome?: string | null
}

/** The public API accepts profiles.user_id, never teachers.id or escola_users.id. */
export function selectedProfessorForLegacyId(
  legacyProfessorId: string | null | undefined,
  professors: ModalProfessor[],
): ModalProfessor | null {
  if (!legacyProfessorId) return null
  return professors.find((professor) =>
    professor.professor_id === legacyProfessorId && Boolean(professor.user_id)
  ) ?? null
}

export type BatchPlan = { turma_id: string; curso_matriz_id: string }[]

/** Preview only; all authorization and conflict checks are repeated by the atomic DB RPC. */
export function planTurmaModalBatch({
  turmaId,
  cursoMatrizId,
  assignedProfessorId,
  selectedProfessor,
  candidates,
  selectedTurmaIds,
}: {
  turmaId: string
  cursoMatrizId: string
  assignedProfessorId: string | null
  selectedProfessor: ModalProfessor | null | undefined
  candidates: AssignmentCandidate[]
  selectedTurmaIds: string[]
}): BatchPlan {
  if (!selectedProfessor?.user_id) throw new Error('Selecione um professor válido.')
  const source = candidates.find((candidate) => candidate.turma_id === turmaId)
  if (!source || source.curso_matriz_id !== cursoMatrizId) {
    throw new Error('A disciplina desta turma não está disponível na matriz publicada do ano letivo ativo.')
  }
  if ((source.professor_id ?? null) !== (assignedProfessorId ?? null)) {
    throw new Error('A atribuição desta turma mudou. Atualize o modal antes de continuar.')
  }
  if (source.professor_id && source.professor_id !== selectedProfessor.professor_id) {
    throw new Error('A turma atual já tem outro professor. Não é possível substituí-lo em lote.')
  }
  const selected = new Set(selectedTurmaIds)
  if (selected.size !== selectedTurmaIds.length) throw new Error('Há turmas repetidas na seleção.')
  if (!source.professor_id && !selected.has(turmaId)) {
    throw new Error('A turma de origem deve fazer parte da atribuição.')
  }
  if (selected.size < 1 || selected.size > 30) throw new Error('Selecione entre 1 e 30 turmas.')
  const byId = new Map(candidates.map((candidate) => [candidate.turma_id, candidate]))
  return selectedTurmaIds.map((id) => {
    const candidate = byId.get(id)
    if (!candidate) throw new Error('Uma turma já não está disponível para esta disciplina.')
    if (candidate.professor_id) throw new Error('Uma turma selecionada já tem professor.')
    return { turma_id: candidate.turma_id, curso_matriz_id: candidate.curso_matriz_id }
  })
}
