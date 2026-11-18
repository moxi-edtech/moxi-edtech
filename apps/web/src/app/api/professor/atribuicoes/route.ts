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
    const matrixIds = Array.from(new Set((links ?? []).map((link) => link.curso_matriz_id).filter((id): id is string => Boolean(id))))
    if (matrixIds.length === 0) {
      return NextResponse.json({ ok: true, escola_id: escolaId, context: academicContext, items: [] })
    }
    const { data: matrices, error: matricesError } = await supabase
      .from('curso_matriz')
      .select('id, curso_id, classe_id, disciplina_id, curso_curriculo_id')
      .eq('escola_id', escolaId)
      .in('id', matrixIds)
      .in('curso_curriculo_id', publishedCurriculoIds)
      .limit(2000)
    if (matricesError || (matrices ?? []).length === 2000) {
      return NextResponse.json({ ok: false, error: 'A matriz curricular está incompleta.' }, { status: 409 })
    }
    const subjectIds = Array.from(new Set((matrices ?? []).map((item) => item.disciplina_id).filter((id): id is string => Boolean(id))))
    const { data: subjects, error: subjectsError } = subjectIds.length
      ? await supabase.from('disciplinas_catalogo').select('id, nome').eq('escola_id', escolaId).in('id', subjectIds).limit(2000)
      : { data: [] as Array<{ id: string; nome: string | null }>, error: null }
    if (subjectsError) return NextResponse.json({ ok: false, error: 'Não foi possível identificar as disciplinas.' }, { status: 500 })

    // Segunda defesa: apenas pares turma/matriz da mesma classe e
    // currículo publicado no ano seleccionado.
    const canonicalByKey = new Set<string>();
    for (const turma of classes ?? []) {
      for (const row of matrices ?? []) {
        if (!row.curso_curriculo_id || !publishedCurriculoSet.has(row.curso_curriculo_id)) continue;
        if (row.curso_id !== turma.curso_id || row.classe_id !== turma.classe_id) continue;
        canonicalByKey.add(`${turma.id}:${row.id}`);
      }
    }
    const canonicalLinks = (links ?? []).filter((row): row is typeof row & { curso_matriz_id: string } =>
      Boolean(row.curso_matriz_id) && canonicalByKey.has(`${row.turma_id}:${row.curso_matriz_id}`));
    const publishedMatrices = (matrices ?? []).filter((row) =>
      row.curso_curriculo_id !== null && publishedCurriculoSet.has(row.curso_curriculo_id));

    const items = selectTeacherCanonicalAssignments({
      professorId,
      classes: classes ?? [],
      links: canonicalLinks,
      matrices: publishedMatrices,
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

  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
