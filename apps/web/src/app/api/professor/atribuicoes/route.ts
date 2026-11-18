import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'
import { AcademicYearContextError, resolveAcademicYearContext } from '@/lib/academic-year/context'
import { selectTeacherCanonicalAssignments } from '@/lib/professor/select-canonical-assignments'

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
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: url.searchParams.get('ano_letivo_id'),
      operation: 'READ',
    })

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()

    const professorId = (professor as ProfessorRow | null)?.id
    if (!professorId) return NextResponse.json({ ok: true, escola_id: escolaId, items: [] })

    // Academic-year identity is the curriculum UUID, not a shared numeric year.
    // Reject old/draft matrices even when the legacy assignment RPC includes them.
    const { data: publishedCurriculos, error: curriculosError } = await supabase
      .from('curso_curriculos')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', academicContext.anoLetivoId)
      .eq('status', 'published')
    if (curriculosError) {
      return NextResponse.json({ ok: false, error: 'Não foi possível consultar o currículo.' }, { status: 500 })
    }
    const publishedCurriculoIds = (publishedCurriculos ?? []).map((row) => row.id)
    const publishedCurriculoSet = new Set(publishedCurriculoIds)
    if (publishedCurriculoIds.length === 0) {
      return NextResponse.json({ ok: true, escola_id: escolaId, context: academicContext, items: [] })
    }

    let query = supabase
      .from('turma_disciplinas_professores')
      .select('turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)

    query = applyKf2ListInvariants(query, { defaultLimit: 1000 })

    const { data: assignments, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    // Reconciliação canónica dos dois modos de atribuição: por vínculo da
    // disciplina e por turma_disciplinas_professores. Não depende do horário.
    // O RPC legado devolve apenas os vínculos da tabela alternativa e pode
    // omitir disciplinas atribuídas directamente a turma_disciplinas.
    const { data: directLinks, error: directError } = await supabase
      .from('turma_disciplinas')
      .select('id, turma_id, curso_matriz_id, professor_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)
      .limit(1000)
    if (directError) return NextResponse.json({ ok: false, error: 'Não foi possível consultar as atribuições directas.' }, { status: 500 })
    if ((directLinks ?? []).length === 1000 || (assignments ?? []).length === 1000) {
      return NextResponse.json({ ok: false, error: 'A lista de atribuições ultrapassa o limite seguro. Solicita paginação à Direção.' }, { status: 409 })
    }

    const candidateTurmaIds = Array.from(new Set([
      ...(assignments ?? []).map((row) => row.turma_id).filter((id): id is string => Boolean(id)),
      ...(directLinks ?? []).map((row) => row.turma_id).filter((id): id is string => Boolean(id)),
    ]))
    if (candidateTurmaIds.length === 0) {
      return NextResponse.json({ ok: true, escola_id: escolaId, context: academicContext, items: [] })
    }

    const { data: classes, error: classesError } = await supabase
      .from('turmas')
      .select('id, nome, curso_id, classe_id, status_fecho')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', academicContext.anoLetivoId)
      .in('id', candidateTurmaIds)
      .limit(1000)
    if (classesError) return NextResponse.json({ ok: false, error: 'Não foi possível consultar as turmas deste ano.' }, { status: 500 })

    const allowedTurmaIds = (classes ?? []).map((turma) => turma.id)
    if (allowedTurmaIds.length === 0) {
      return NextResponse.json({ ok: true, escola_id: escolaId, context: academicContext, items: [] })
    }
    const { data: links, error: linksError } = await supabase
      .from('turma_disciplinas')
      .select('id, turma_id, curso_matriz_id, professor_id')
      .eq('escola_id', escolaId)
      .in('turma_id', allowedTurmaIds)
      .limit(2000)
    if (linksError || (links ?? []).length === 2000) {
      return NextResponse.json({ ok: false, error: 'Vínculos curriculares incompletos ou indisponíveis.' }, { status: 409 })
    }
    const matrixIds = Array.from(new Set((links ?? []).map((link) => link.curso_matriz_id)))
    if (matrixIds.length === 0) {
      return NextResponse.json({ ok: true, escola_id: escolaId, context: academicContext, items: [] })
    }
    const { data: matrices, error: matricesError } = await supabase
      .from('curso_matriz')
      .select('id, curso_id, classe_id, disciplina_id, curso_curriculo_id')
      .eq('escola_id', escolaId)
      .in('id', matrixIds)
      .limit(2000)
    if (matricesError || (matrices ?? []).length === 2000) {
      return NextResponse.json({ ok: false, error: 'A matriz curricular está incompleta.' }, { status: 409 })
    }
    const subjectIds = Array.from(new Set((matrices ?? []).map((item) => item.disciplina_id).filter((id): id is string => Boolean(id))))
    const { data: subjects, error: subjectsError } = subjectIds.length
      ? await supabase.from('disciplinas_catalogo').select('id, nome').eq('escola_id', escolaId).in('id', subjectIds).limit(2000)
      : { data: [] as Array<{ id: string; nome: string | null }>, error: null }
    if (subjectsError) return NextResponse.json({ ok: false, error: 'Não foi possível identificar as disciplinas.' }, { status: 500 })

    const items = selectTeacherCanonicalAssignments({
      professorId,
      classes: classes ?? [],
      links: links ?? [],
      matrices: matrices ?? [],
      subjects: subjects ?? [],
      alternate: (assignments ?? []).filter((row): row is { turma_id: string; disciplina_id: string } =>
        Boolean(row.turma_id && row.disciplina_id)),
      publishedCurriculumIds: publishedCurriculoSet,
    })
    return NextResponse.json({
      ok: true,
      escola_id: escolaId,
      context: academicContext,
      items,
      ...(debug ? { debug: { total: items.length, candidate_turmas: candidateTurmaIds.length } } : {}),
    })

    const turmaIds = Array.from(
      new Set((assignments || []).map((r: AssignmentRow) => r.turma_id).filter((id): id is string => Boolean(id)))
    )

    const turmaMetaRows = turmaIds.length
      ? await supabase
          .from('turmas')
          .select('id, nome, curso_id, classe_id, status_fecho, session_id')
          .in('id', turmaIds)
          .eq('escola_id', escolaId)
          .eq('session_id', academicContext.anoLetivoId)
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
          .in('curso_curriculo_id', publishedCurriculoIds)
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
            .in('curso_curriculo_id', publishedCurriculoIds)
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
      if (matrizByKey.has(key) && matrizByKey.get(key)?.id !== row.id) {
        return NextResponse.json({
          ok: false, error: 'A disciplina possui versões curriculares publicadas duplicadas.',
        }, { status: 409 })
      }
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
        context: academicContext,
        items: Array.from(
          new Map(fallbackItems.map((item: any) => [`${item.turma.id}:${item.disciplina.id}`, item])).values(),
        ),
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
      context: academicContext,
      items: Array.from(
        new Map((items as any[]).map((item) => [`${item.turma.id}:${item.disciplina.id}`, item])).values(),
      ),
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
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
