import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

type ProfessorRow = { id: string }
type TurmaDisciplinaRow = {
  id: string
  turma_id: string | null
  curso_matriz_id: string | null
  curso_matriz?: { disciplina_id?: string | null; disciplina?: { id?: string | null; nome?: string | null } | null } | null
}
type AssignmentRow = { turma_id: string | null; disciplina_id: string | null }
type TurmaMetaRow = {
  id: string
  nome: string | null
  curso_id: string | null
  classe_id: string | null
  status_fecho: string | null
}
type CursoMatrizRow = {
  id: string
  curso_id: string | null
  classe_id: string | null
  disciplina_id: string | null
  disciplina?: { id?: string | null; nome?: string | null } | null
}
type ResolvedAssignment = {
  turma_id: string
  curso_matriz_id: string
  disciplina_id: string | null
  disciplina_nome: string | null
}

// GET /api/professor/atribuicoes
// Lista atribuições (turma, disciplina) para o professor logado
export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve escola ativa
    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()

    const professorId = (professor as ProfessorRow | null)?.id
    if (!professorId) return NextResponse.json({ ok: true, escola_id: escolaId, items: [] })

    let query = supabase
      .from('turma_disciplinas_professores')
      .select('turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)

    query = applyKf2ListInvariants(query, { defaultLimit: 50 })

    const { data: assignments, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const turmaIds = Array.from(
      new Set((assignments || []).map((r: AssignmentRow) => r.turma_id).filter((id): id is string => Boolean(id)))
    )

    const turmaMetaRows = turmaIds.length
      ? await supabase
          .from('turmas')
          .select('id, nome, curso_id, classe_id, status_fecho')
          .in('id', turmaIds)
          .eq('escola_id', escolaId)
      : { data: [] as TurmaMetaRow[] }

    const turmaMeta = (turmaMetaRows as { data?: TurmaMetaRow[] }).data || []
    const turmaMap = new Map<
      string,
      { nome: string | null; curso_id: string | null; classe_id: string | null; status_fecho: string | null }
    >()
    for (const t of turmaMeta) {
      turmaMap.set(t.id, {
        nome: t.nome ?? null,
        curso_id: t.curso_id ?? null,
        classe_id: t.classe_id ?? null,
        status_fecho: t.status_fecho ?? null,
      })
    }

    const disciplinaIds = Array.from(
      new Set((assignments || []).map((r: AssignmentRow) => r.disciplina_id).filter((id): id is string => Boolean(id)))
    )
    const classeIds = Array.from(
      new Set(turmaMeta.map((t: TurmaMetaRow) => t.classe_id).filter((id): id is string => Boolean(id)))
    )

    const matrizRows = disciplinaIds.length && classeIds.length
      ? await supabase
          .from('curso_matriz')
          .select('id, curso_id, classe_id, disciplina_id, disciplina:disciplinas_catalogo(id, nome)')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .in('disciplina_id', disciplinaIds)
          .in('classe_id', classeIds)
      : { data: [] as CursoMatrizRow[] }

    const matrizByKey = new Map<string, { id: string; disciplinaId: string | null; disciplinaNome: string | null }>()
    for (const row of ((matrizRows as { data?: CursoMatrizRow[] }).data || [])) {
      const key = `${row.curso_id}:${row.classe_id}:${row.disciplina_id}`
      matrizByKey.set(key, {
        id: row.id,
        disciplinaId: row.disciplina_id ?? row.disciplina?.id ?? null,
        disciplinaNome: row.disciplina?.nome ?? null,
      })
    }

    const resolvedAssignments = (assignments || [])
      .map((row: AssignmentRow) => {
        if (!row.turma_id || !row.disciplina_id) return null
        const turmaInfo = turmaMap.get(row.turma_id)
        if (!turmaInfo?.curso_id || !turmaInfo?.classe_id) return null
        const key = `${turmaInfo.curso_id}:${turmaInfo.classe_id}:${row.disciplina_id}`
        const matriz = matrizByKey.get(key)
        if (!matriz?.id) return null
        return {
          turma_id: row.turma_id,
          curso_matriz_id: matriz.id,
          disciplina_id: matriz.disciplinaId ?? row.disciplina_id,
          disciplina_nome: matriz.disciplinaNome ?? null,
        }
      })
      .filter(Boolean) as ResolvedAssignment[]

    const resolvedTurmaIds = Array.from(new Set(resolvedAssignments.map((r) => r.turma_id)))
    const resolvedMatrizIds = Array.from(new Set(resolvedAssignments.map((r) => r.curso_matriz_id)))

    const turmaDisciplinaRows = resolvedTurmaIds.length && resolvedMatrizIds.length
      ? await supabase
          .from('turma_disciplinas')
          .select('id, turma_id, curso_matriz_id')
          .eq('escola_id', escolaId)
          .in('turma_id', resolvedTurmaIds)
          .in('curso_matriz_id', resolvedMatrizIds)
      : { data: [] as TurmaDisciplinaRow[] }

    const turmaDisciplinaMap = new Map<string, { id: string; turma_id: string; curso_matriz_id: string }>()
    for (const row of ((turmaDisciplinaRows as { data?: TurmaDisciplinaRow[] }).data || [])) {
      const turmaId = row.turma_id
      const matrizId = row.curso_matriz_id
      if (!turmaId || !matrizId) continue
      turmaDisciplinaMap.set(`${turmaId}:${matrizId}`, {
        id: row.id,
        turma_id: turmaId,
        curso_matriz_id: matrizId,
      })
    }

    const items = resolvedAssignments
      .map((r) => {
        const key = `${r.turma_id}:${r.curso_matriz_id}`
        const turmaDisciplina = turmaDisciplinaMap.get(key)
        if (!turmaDisciplina) return null
        const turmaInfo = turmaMap.get(r.turma_id)
        return {
          id: turmaDisciplina.id,
          turma_disciplina_id: turmaDisciplina.id,
          curso_matriz_id: r.curso_matriz_id,
          turma: { id: r.turma_id, nome: turmaInfo?.nome ?? null, status_fecho: turmaInfo?.status_fecho ?? null },
          disciplina: { id: r.disciplina_id ?? null, nome: r.disciplina_nome ?? null },
        }
      })
      .filter(Boolean)
    return NextResponse.json({ ok: true, escola_id: escolaId, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
