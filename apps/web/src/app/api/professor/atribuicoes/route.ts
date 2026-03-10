import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const debug = url.searchParams.get('debug') === '1'
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

    const { data: rpcItems, error: rpcError } = await (supabase as any).rpc('get_professor_atribuicoes')
    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 })
    }

    if (Array.isArray(rpcItems) && rpcItems.length > 0) {
      const items = rpcItems.map((row: any) => ({
        id: row.turma_disciplina_id,
        turma_disciplina_id: row.turma_disciplina_id,
        curso_matriz_id: row.curso_matriz_id,
        turma: {
          id: row.turma_id,
          nome: row.turma_nome ?? null,
          status_fecho: row.turma_status_fecho ?? null,
        },
        disciplina: {
          id: row.disciplina_id ?? null,
          nome: row.disciplina_nome ?? null,
        },
      }))

      return NextResponse.json({
        ok: true,
        escola_id: escolaId,
        items,
        ...(debug ? { debug: { rpc_items_count: items.length } } : {}),
      })
    }

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

    const disciplinaRows = disciplinaIds.length
      ? await supabase
          .from('disciplinas_catalogo')
          .select('id, nome')
          .eq('escola_id', escolaId)
          .in('id', disciplinaIds)
      : { data: [] as Array<{ id: string; nome: string | null }> }

    const disciplinaMap = new Map<string, string | null>()
    for (const row of ((disciplinaRows as { data?: Array<{ id: string; nome: string | null }> }).data || [])) {
      disciplinaMap.set(row.id, row.nome ?? null)
    }

    let matrizError: string | null = null
    const { data: matrizData, error: matrizErr } = disciplinaIds.length && classeIds.length
      ? await supabase
          .from('curso_matriz')
          .select('id, curso_id, classe_id, disciplina_id')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .in('disciplina_id', disciplinaIds)
          .in('classe_id', classeIds)
      : { data: [] as CursoMatrizRow[], error: null }

    if (matrizErr) {
      matrizError = matrizErr.message
    }

    let matrizRows: CursoMatrizRow[] = (matrizData as CursoMatrizRow[] | null) || []
    let fallbackMatrizError: string | null = null

    if (matrizRows.length === 0 && turmaMeta.length > 0) {
      const cursoIds = Array.from(
        new Set(turmaMeta.map((t) => t.curso_id).filter((id): id is string => Boolean(id)))
      )
      const { data: fallbackData, error: fallbackErr } = cursoIds.length && classeIds.length
        ? await supabase
            .from('curso_matriz')
            .select('id, curso_id, classe_id, disciplina_id')
            .eq('escola_id', escolaId)
            .eq('ativo', true)
            .in('curso_id', cursoIds)
            .in('classe_id', classeIds)
        : { data: [] as CursoMatrizRow[], error: null }
      if (fallbackErr) {
        fallbackMatrizError = fallbackErr.message
      }
      matrizRows = (fallbackData as CursoMatrizRow[] | null) || []
    }

    const matrizByKey = new Map<string, { id: string; disciplinaId: string | null; disciplinaNome: string | null }>()
    for (const row of matrizRows) {
      const key = `${row.curso_id}:${row.classe_id}:${row.disciplina_id}`
      matrizByKey.set(key, {
        id: row.id,
        disciplinaId: row.disciplina_id ?? row.disciplina?.id ?? null,
        disciplinaNome: row.disciplina?.nome ?? disciplinaMap.get(row.disciplina_id ?? '') ?? null,
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

    if (items.length === 0 && resolvedAssignments.length > 0) {
      const fallbackItems = resolvedAssignments
        .map((r) => {
          const turmaDisciplina = turmaDisciplinaMap.get(`${r.turma_id}:${r.curso_matriz_id}`)
          if (!turmaDisciplina) return null
          const turmaInfo = turmaMap.get(r.turma_id)
          return {
            id: turmaDisciplina.id,
            turma_disciplina_id: turmaDisciplina.id,
            curso_matriz_id: r.curso_matriz_id,
            turma: { id: r.turma_id, nome: turmaInfo?.nome ?? null, status_fecho: turmaInfo?.status_fecho ?? null },
            disciplina: {
              id: r.disciplina_id ?? null,
              nome: r.disciplina_nome ?? disciplinaMap.get(r.disciplina_id ?? '') ?? null,
            },
          }
        })
        .filter(Boolean)
      return NextResponse.json({
        ok: true,
        escola_id: escolaId,
        items: fallbackItems,
        ...(debug
          ? {
              debug: {
                assignments_count: (assignments || []).length,
                assignments_sample: (assignments || []).slice(0, 3),
                turma_meta_count: turmaMeta.length,
                turma_meta_sample: turmaMeta.slice(0, 3),
                disciplina_ids_count: disciplinaIds.length,
                classe_ids_count: classeIds.length,
                disciplina_ids: disciplinaIds.slice(0, 5),
                classe_ids: classeIds.slice(0, 5),
                matriz_rows_count: matrizRows.length,
                matriz_error: matrizError,
                fallback_matriz_error: fallbackMatrizError,
                resolved_assignments_count: resolvedAssignments.length,
                turma_disciplinas_count: (turmaDisciplinaRows as { data?: TurmaDisciplinaRow[] }).data?.length ?? 0,
                fallback_items_count: fallbackItems.length,
              },
            }
          : {}),
      })
    }
    return NextResponse.json({
      ok: true,
      escola_id: escolaId,
      items,
      ...(debug
        ? {
            debug: {
              assignments_count: (assignments || []).length,
              assignments_sample: (assignments || []).slice(0, 3),
              turma_meta_count: turmaMeta.length,
              turma_meta_sample: turmaMeta.slice(0, 3),
              disciplina_ids_count: disciplinaIds.length,
              classe_ids_count: classeIds.length,
              disciplina_ids: disciplinaIds.slice(0, 5),
              classe_ids: classeIds.slice(0, 5),
              matriz_rows_count: matrizRows.length,
              matriz_error: matrizError,
              fallback_matriz_error: fallbackMatrizError,
              resolved_assignments_count: resolvedAssignments.length,
              turma_disciplinas_count: (turmaDisciplinaRows as { data?: TurmaDisciplinaRow[] }).data?.length ?? 0,
              items_count: items.length,
            },
          }
        : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
