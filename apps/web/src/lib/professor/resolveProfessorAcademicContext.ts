import "server-only"

type SupabaseLike = {
  from: (table: string) => any
}

export type ProfessorAcademicContext = {
  professorId: string
  turmaDisciplinaId: string
  cursoMatrizId: string
  disciplinaId: string
}

export async function resolveProfessorAcademicContext({
  supabase,
  escolaId,
  userId,
  turmaId,
  disciplinaId,
  turmaDisciplinaId,
}: {
  supabase: SupabaseLike
  escolaId: string
  userId: string
  turmaId: string
  disciplinaId?: string
  turmaDisciplinaId?: string
}): Promise<ProfessorAcademicContext | null> {
  const { data: professor } = await supabase
    .from("professores")
    .select("id")
    .eq("profile_id", userId)
    .eq("escola_id", escolaId)
    .maybeSingle()
  if (!professor?.id) return null

  let assignmentQuery = supabase
    .from("turma_disciplinas_professores")
    .select("disciplina_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("professor_id", professor.id)
  if (disciplinaId) assignmentQuery = assignmentQuery.eq("disciplina_id", disciplinaId)
  const { data: assignment } = await assignmentQuery.limit(1).maybeSingle()
  if (!assignment?.disciplina_id) return null

  let turmaDisciplinaQuery = supabase
    .from("turma_disciplinas")
    .select("id, curso_matriz_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
  if (turmaDisciplinaId) turmaDisciplinaQuery = turmaDisciplinaQuery.eq("id", turmaDisciplinaId)
  const { data: turmaDisciplinas } = await turmaDisciplinaQuery
  const matrizIds = (turmaDisciplinas ?? []).map((row: any) => row.curso_matriz_id).filter(Boolean)
  if (matrizIds.length === 0) return null

  const { data: matrizes } = await supabase
    .from("curso_matriz")
    .select("id, disciplina_id")
    .eq("escola_id", escolaId)
    .in("id", matrizIds)
  const matrizById = new Map<string, { id: string; disciplina_id: string | null }>(
    (matrizes ?? []).map((row: any) => [row.id, row as { id: string; disciplina_id: string | null }]),
  )
  const resolved = (turmaDisciplinas ?? []).find((row: any) => {
    const matriz = matrizById.get(row.curso_matriz_id)
    return matriz?.disciplina_id === assignment.disciplina_id
  })
  if (!resolved?.id || !resolved.curso_matriz_id) return null

  return {
    professorId: professor.id,
    turmaDisciplinaId: resolved.id,
    cursoMatrizId: resolved.curso_matriz_id,
    disciplinaId: assignment.disciplina_id,
  }
}
