/**
 * Pure selector for active-year, published subject offerings.
 * Authorization and school/year scoping are enforced by the caller + database.
 */
export type TeacherTurmaRow = {
  id: string
  nome: string | null
  turno: string | null
  curso_id: string | null
  classe_id: string | null
}

export type TeacherMatrizRow = {
  id: string
  curso_curriculo_id: string | null
  curso_id: string | null
  classe_id: string | null
  ativo: boolean | null
}

export type TeacherOfertaRow = {
  turma_id: string
  curso_matriz_id: string
  professor_id: string | null
}

export type TeacherSharedLinkRow = {
  turma_id: string
  professor_id: string | null
}

export type AssignmentCandidate = {
  turma_id: string
  nome: string
  turno: string | null
  curso_matriz_id: string
  professor_id: string | null
}

export type CandidateResolution =
  | { ok: true; items: AssignmentCandidate[] }
  | { ok: false; reason: 'DUPLICATE_PUBLISHED_OFFERING' }

export function buildTeacherAssignmentCandidates({
  turmas,
  currentPublishedCurriculoIds,
  matrizes,
  ofertas,
  links,
}: {
  turmas: TeacherTurmaRow[]
  currentPublishedCurriculoIds: string[]
  matrizes: TeacherMatrizRow[]
  ofertas: TeacherOfertaRow[]
  links: TeacherSharedLinkRow[]
}): CandidateResolution {
  const published = new Set(currentPublishedCurriculoIds)
  const turmaById = new Map(turmas.map((t) => [t.id, t]))
  const matrizById = new Map(matrizes.map((m) => [m.id, m]))
  const occupiedByTurma = new Map<string, string>()

  // An owner in a historical matrix attached to the same turma still makes it
  // unsafe to offer the subject as available; server guards the same case.
  for (const link of links) {
    if (link.professor_id) occupiedByTurma.set(link.turma_id, link.professor_id)
  }
  for (const oferta of ofertas) {
    if (oferta.professor_id) occupiedByTurma.set(oferta.turma_id, oferta.professor_id)
  }

  const candidates = new Map<string, AssignmentCandidate>()
  for (const oferta of ofertas) {
    const turma = turmaById.get(oferta.turma_id)
    const matriz = matrizById.get(oferta.curso_matriz_id)
    if (!turma || !matriz || matriz.ativo !== true || !matriz.curso_curriculo_id
      || !published.has(matriz.curso_curriculo_id)) continue
    if (matriz.curso_id !== turma.curso_id || matriz.classe_id !== turma.classe_id) continue

    const current = candidates.get(turma.id)
    if (current && current.curso_matriz_id !== matriz.id) {
      return { ok: false, reason: 'DUPLICATE_PUBLISHED_OFFERING' }
    }
    candidates.set(turma.id, {
      turma_id: turma.id,
      nome: turma.nome ?? 'Turma',
      turno: turma.turno ?? null,
      curso_matriz_id: matriz.id,
      professor_id: occupiedByTurma.get(turma.id) ?? null,
    })
  }

  return {
    ok: true,
    items: turmas.flatMap((t) => {
      const item = candidates.get(t.id)
      return item ? [item] : []
    }),
  }
}
