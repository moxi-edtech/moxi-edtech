import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type ProfessorRow = { id: string }
type TurmaDisciplinaRow = {
  id: string
  turma_id: string | null
  curso_matriz_id: string | null
  curso_matriz?: { disciplina_id?: string | null; disciplina?: { id?: string | null } | null } | null
}
type AssignmentRow = { turma_id: string | null; disciplina_id: string | null }
type TurmaMetaRow = { id: string; curso_id: string | null; classe_id: string | null }
type CursoMatrizRow = {
  id: string
  curso_id: string | null
  classe_id: string | null
  disciplina_id: string | null
  disciplina?: { id?: string | null } | null
}

type PendenciaRow = {
  turma_disciplina_id: string | null
  avaliacao_id: string | null
  pendentes: number | null
  total_alunos: number | null
  trimestre: number | null
}

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) {
      return NextResponse.json({ ok: true, avaliacoes_pendentes: 0, faltas_a_lancar: 0 })
    }

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()

    const professorId = (professor as ProfessorRow | null)?.id
    if (!professorId) {
      return NextResponse.json({ ok: true, avaliacoes_pendentes: 0, faltas_a_lancar: 0 })
    }

    let query = supabase
      .from('turma_disciplinas_professores')
      .select('turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)

    query = applyKf2ListInvariants(query, { defaultLimit: 50 })
    const { data: assignments, error: assignmentsErr } = await query
    if (assignmentsErr) return NextResponse.json({ ok: false, error: assignmentsErr.message }, { status: 400 })

    const turmaIds = Array.from(
      new Set((assignments || []).map((row: AssignmentRow) => row.turma_id).filter((id): id is string => Boolean(id)))
    )

    const turmaMetaRows = turmaIds.length
      ? await supabase
          .from('turmas')
          .select('id, curso_id, classe_id')
          .in('id', turmaIds)
          .eq('escola_id', escolaId)
      : { data: [] as TurmaMetaRow[] }

    const turmaMeta = (turmaMetaRows as { data?: TurmaMetaRow[] }).data || []
    const turmaMap = new Map<string, { curso_id: string | null; classe_id: string | null }>()
    for (const t of turmaMeta) {
      turmaMap.set(t.id, { curso_id: t.curso_id ?? null, classe_id: t.classe_id ?? null })
    }

    const disciplinaIds = Array.from(
      new Set((assignments || []).map((row: AssignmentRow) => row.disciplina_id).filter((id): id is string => Boolean(id)))
    )
    const classeIds = Array.from(
      new Set(turmaMeta.map((row: TurmaMetaRow) => row.classe_id).filter((id): id is string => Boolean(id)))
    )

    const matrizRows = disciplinaIds.length && classeIds.length
      ? await supabase
          .from('curso_matriz')
          .select('id, curso_id, classe_id, disciplina_id, disciplina:disciplinas_catalogo(id)')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .in('disciplina_id', disciplinaIds)
          .in('classe_id', classeIds)
      : { data: [] as CursoMatrizRow[] }

    const matrizByKey = new Map<string, { id: string; disciplinaId: string | null }>()
    for (const row of ((matrizRows as { data?: CursoMatrizRow[] }).data || [])) {
      const key = `${row.curso_id}:${row.classe_id}:${row.disciplina_id}`
      matrizByKey.set(key, {
        id: row.id,
        disciplinaId: row.disciplina_id ?? row.disciplina?.id ?? null,
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
        }
      })
      .filter(Boolean) as Array<{ turma_id: string; curso_matriz_id: string; disciplina_id?: string | null }>

    const resolvedTurmaIds = Array.from(new Set(resolvedAssignments.map((row) => row.turma_id)))
    const resolvedMatrizIds = Array.from(new Set(resolvedAssignments.map((row) => row.curso_matriz_id)))

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
      if (!row.turma_id || !row.curso_matriz_id) continue
      turmaDisciplinaMap.set(`${row.turma_id}:${row.curso_matriz_id}`, {
        id: row.id,
        turma_id: row.turma_id,
        curso_matriz_id: row.curso_matriz_id,
      })
    }

    const assignmentPairs = resolvedAssignments
      .map((row) => {
        const key = `${row.turma_id}:${row.curso_matriz_id}`
        const turmaDisciplina = turmaDisciplinaMap.get(key)
        if (!turmaDisciplina) return null
        return {
          turma_id: row.turma_id,
          turma_disciplina_id: turmaDisciplina.id,
          disciplina_id: row.disciplina_id ?? null,
        }
      })
      .filter(Boolean) as Array<{ turma_id: string; turma_disciplina_id: string; disciplina_id: string | null }>

    const { data: pendenciasRows } = await supabase
      .from('vw_professor_pendencias')
      .select('turma_disciplina_id, avaliacao_id, pendentes, total_alunos, trimestre')
      .eq('escola_id', escolaId)
      .eq('profile_id', user.id)

    const pendenciasByTurma = new Map<string, { pendenciasCount: number; trimestre: number | null }>()
    for (const row of (pendenciasRows || []) as PendenciaRow[]) {
      if (!row.turma_disciplina_id) continue
      const totalAlunos = row.total_alunos ?? 0
      const pendentes = row.pendentes ?? 0
      const hasPending = totalAlunos > 0 && (!row.avaliacao_id || pendentes > 0)
      if (!hasPending) continue

      const current = pendenciasByTurma.get(row.turma_disciplina_id)
      const next = pendentes > 0 ? pendentes : 1
      if (!current || next > current.pendenciasCount) {
        pendenciasByTurma.set(row.turma_disciplina_id, {
          pendenciasCount: next,
          trimestre: typeof row.trimestre === 'number' ? row.trimestre : null,
        })
      }
    }

    const avaliacoesPendentes = pendenciasByTurma.size

    const today = new Date().toISOString().slice(0, 10)
    const turmaIdsForAttendance = Array.from(new Set(assignmentPairs.map((row) => row.turma_id).filter(Boolean)))
    const disciplinaIdsForAttendance = Array.from(
      new Set(assignmentPairs.map((row) => row.disciplina_id).filter((id): id is string => Boolean(id)))
    )

    const presencasRows = turmaIdsForAttendance.length && disciplinaIdsForAttendance.length
      ? await supabase
          .from('vw_presencas_por_turma')
          .select('turma_id, disciplina_id')
          .eq('escola_id', escolaId)
          .eq('data', today)
          .in('turma_id', turmaIdsForAttendance)
          .in('disciplina_id', disciplinaIdsForAttendance)
      : { data: [] as Array<{ turma_id: string | null; disciplina_id: string | null }> }

    const presencasSet = new Set<string>()
    for (const row of (presencasRows as { data?: Array<{ turma_id: string | null; disciplina_id: string | null }> }).data || []) {
      if (!row?.turma_id || !row?.disciplina_id) continue
      presencasSet.add(`${row.turma_id}:${row.disciplina_id}`)
    }

    const faltasALancar = assignmentPairs.filter((row) => {
      if (!row.disciplina_id) return false
      return !presencasSet.has(`${row.turma_id}:${row.disciplina_id}`)
    }).length

    return NextResponse.json({
      ok: true,
      avaliacoes_pendentes: avaliacoesPendentes,
      faltas_a_lancar: faltasALancar,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
