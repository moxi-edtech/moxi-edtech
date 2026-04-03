import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

// GET /api/secretaria/turmas/:id/disciplinas
// Returns assigned disciplinas for a turma with professor info and simple linkage checks
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    const { data: userRes } = await supabase.auth.getUser()
    let user = userRes?.user
    if (!user) {
      const authHeader = req.headers.get('authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (token) {
        const { data: tokenUser } = await supabase.auth.getUser(token)
        user = tokenUser?.user ?? null
      }
    }
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId } = await ctx.params

    const { searchParams } = new URL(req.url)
    const requestedEscolaId = searchParams.get('escola_id')
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId)
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 }, { headers })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`)

    // Load assignments
    let query = supabase
      .from('turma_disciplinas')
      .select('id, turma_id, curso_matriz_id, professor_id, carga_horaria_semanal, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_disciplina_id, modelo_avaliacao_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)

    query = applyKf2ListInvariants(query);

    const { data: rows, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })

    const disciplinaIds = Array.from(new Set((rows || []).map((r: any) => r.curso_matriz_id).filter(Boolean)))

    // Fetch disciplina names
    const [discRes, turmaRes] = await Promise.all([
      disciplinaIds.length
        ? supabase
          .from('curso_matriz')
          .select('id, disciplina_id, carga_horaria_semanal, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome), curriculo:curso_curriculos(id, status)')
          .in('id', disciplinaIds)
          .eq('escola_id', escolaId)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('turmas')
        .select('id, ano_letivo_id, ano_letivo')
        .eq('escola_id', escolaId)
        .eq('id', turmaId)
        .maybeSingle(),
    ])

    let anoLetivoId = turmaRes.data?.ano_letivo_id ?? null
    if (!anoLetivoId && turmaRes.data?.ano_letivo) {
      const { data: anoRow } = await supabase
        .from('anos_letivos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('ano', turmaRes.data.ano_letivo)
        .maybeSingle()
      anoLetivoId = anoRow?.id ?? null
    }

    const { data: periodosRows } = anoLetivoId
      ? await supabase
          .from('periodos_letivos')
          .select('id, numero, dt_inicio, dt_fim')
          .eq('escola_id', escolaId)
          .eq('ano_letivo_id', anoLetivoId)
          .order('numero', { ascending: true })
      : { data: [] as any[] };

    const discMap = new Map<
      string,
      { id: string | null; nome: string | null; curriculo_status?: string | null; carga_horaria_semanal?: number | null }
    >()
    for (const d of (discRes as any).data || []) {
      const nome = (d as any)?.disciplina?.nome as string | undefined
      const curriculoStatus = (d as any)?.curriculo?.status ?? null
      const disciplinaId = (d as any)?.disciplina_id ?? null
      const cargaHorariaSemanal = (d as any)?.carga_horaria_semanal ?? null
      if (nome || disciplinaId) {
        discMap.set((d as any).id, {
          id: disciplinaId,
          nome: nome ?? null,
          curriculo_status: curriculoStatus,
          carga_horaria_semanal: cargaHorariaSemanal,
        })
      }
    }

    const disciplinaCatalogIds = Array.from(
      new Set(Array.from(discMap.values()).map((d) => d.id).filter(Boolean))
    ) as string[]
    const { data: tdpRows } = disciplinaCatalogIds.length
      ? await supabase
          .from('turma_disciplinas_professores')
          .select('turma_id, disciplina_id, professor_id, horarios, planejamento')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .in('disciplina_id', disciplinaCatalogIds)
      : {
          data: [] as Array<{
            turma_id: string | null
            disciplina_id: string | null
            professor_id: string | null
            horarios: any
            planejamento: any
          }>,
        }

    const professorIds = Array.from(
      new Set([
        ...(tdpRows || []).map((row) => row.professor_id).filter(Boolean),
        ...(rows || []).map((row: any) => row.professor_id).filter(Boolean),
      ])
    ) as string[]
    const { data: profRes } = professorIds.length
      ? await supabase
          .from('professores')
          .select('id, profiles!professores_profile_id_fkey ( user_id, nome, email )')
          .in('id', professorIds)
          .eq('escola_id', escolaId)
      : { data: [] as any[] }

    const profRowById = new Map<string, any>()
    for (const r of ((profRes as any).data || [])) profRowById.set(r.id, r)

    const assignmentByDisciplina = new Map<
      string,
      { professor_id: string | null; horarios: any; planejamento: any }
    >()
    for (const row of (tdpRows || [])) {
      if (!row.turma_id || !row.disciplina_id) continue
      assignmentByDisciplina.set(`${row.turma_id}:${row.disciplina_id}`, {
        professor_id: row.professor_id ?? null,
        horarios: (row as any).horarios ?? null,
        planejamento: (row as any).planejamento ?? null,
      })
    }

    // Simple linkage checks per assignment (prefer FK columns when available)
    let periodos = (periodosRows ?? []).map((periodo: any) => ({
      id: periodo.id,
      numero: periodo.numero,
      dt_inicio: periodo.dt_inicio,
      dt_fim: periodo.dt_fim,
    }))
    if (periodos.length === 0) {
      periodos = [1, 2, 3].map((numero) => ({
        id: `fallback-${numero}`,
        numero,
        dt_inicio: null,
        dt_fim: null,
      }))
    }

    const cursoMatrizIds = Array.from(
      new Set((rows || []).map((row: any) => row.curso_matriz_id).filter(Boolean))
    ) as string[]

    const [notasBatch, presencasBatch, presencasTurmaBatch] = await Promise.all([
      cursoMatrizIds.length
        ? supabase
            .from('notas')
            .select('curso_matriz_id')
            .eq('escola_id', escolaId)
            .eq('turma_id', turmaId)
            .in('curso_matriz_id', cursoMatrizIds)
        : Promise.resolve({ data: [] as Array<{ curso_matriz_id: string | null }> }),
      cursoMatrizIds.length
        ? supabase
            .from('presencas')
            .select('curso_matriz_id')
            .eq('escola_id', escolaId)
            .eq('turma_id', turmaId)
            .in('curso_matriz_id', cursoMatrizIds)
        : Promise.resolve({ data: [] as Array<{ curso_matriz_id: string | null }> }),
      supabase
        .from('presencas')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('turma_id', turmaId)
        .limit(1),
    ])

    const notasByCursoMatriz = new Set<string>()
    for (const item of notasBatch.data || []) {
      if (item?.curso_matriz_id) notasByCursoMatriz.add(item.curso_matriz_id)
    }

    const presencasByCursoMatriz = new Set<string>()
    for (const item of presencasBatch.data || []) {
      if (item?.curso_matriz_id) presencasByCursoMatriz.add(item.curso_matriz_id)
    }

    const hasPresencasTurma = Boolean((presencasTurmaBatch.data || []).length > 0)

    const horarioTargets = (rows || [])
      .map((row: any) => {
        const discInfo = discMap.get(row.curso_matriz_id)
        const assignment = discInfo?.id ? assignmentByDisciplina.get(`${turmaId}:${discInfo.id}`) : null
        const professorId = assignment?.professor_id ?? row.professor_id ?? null
        const disciplinaId = discInfo?.id ?? row.curso_matriz_id ?? null
        if (!professorId || !disciplinaId) return null
        return { professorId, disciplinaId }
      })
      .filter(Boolean) as Array<{ professorId: string; disciplinaId: string }>

    const horarioProfessorIds = Array.from(new Set(horarioTargets.map((target) => target.professorId)))
    const horarioDisciplinaIds = Array.from(new Set(horarioTargets.map((target) => target.disciplinaId)))

    const { data: quadroBatch } =
      horarioProfessorIds.length > 0 && horarioDisciplinaIds.length > 0
        ? await supabase
            .from('quadro_horarios')
            .select('professor_id, disciplina_id')
            .eq('escola_id', escolaId)
            .eq('turma_id', turmaId)
            .in('professor_id', horarioProfessorIds)
            .in('disciplina_id', horarioDisciplinaIds)
        : { data: [] as Array<{ professor_id: string | null; disciplina_id: string | null }> }

    const horarioPairs = new Set<string>()
    for (const row of quadroBatch || []) {
      if (!row.professor_id || !row.disciplina_id) continue
      horarioPairs.add(`${row.professor_id}:${row.disciplina_id}`)
    }

    const items = [] as any[]
    for (const row of rows || []) {
      const discInfo = discMap.get(row.curso_matriz_id)
      const disciplinaNome = discInfo?.nome ?? null
      const assignment = discInfo?.id ? assignmentByDisciplina.get(`${turmaId}:${discInfo.id}`) : null
      const professorId = assignment?.professor_id ?? row.professor_id ?? null
      const profRow = professorId ? profRowById.get(professorId) : null
      const profile = Array.isArray(profRow?.profiles) ? profRow?.profiles?.[0] : profRow?.profiles
      const disciplinaIdForHorario = discInfo?.id ?? row.curso_matriz_id ?? null
      const notasCount = row.curso_matriz_id && notasByCursoMatriz.has(row.curso_matriz_id) ? 1 : 0
      const horarioOficialCount =
        professorId && disciplinaIdForHorario && horarioPairs.has(`${professorId}:${disciplinaIdForHorario}`) ? 1 : 0
      const presencasCount = row.curso_matriz_id
        ? presencasByCursoMatriz.has(row.curso_matriz_id) ? 1 : 0
        : hasPresencasTurma ? 1 : 0

      const hasPlanejamento =
        assignment?.planejamento != null &&
        (!(typeof assignment.planejamento === 'object') || Object.keys(assignment.planejamento).length > 0)

      items.push({
        id: row.id,
        turma_id: row.turma_id,
        curso_matriz_id: row.curso_matriz_id,
        disciplina: { id: discInfo?.id ?? row.curso_matriz_id, nome: disciplinaNome },
        curriculo_status: discInfo?.curriculo_status ?? null,
        meta: {
          carga_horaria_semanal: row.carga_horaria_semanal ?? discInfo?.carga_horaria_semanal ?? null,
          classificacao: row.classificacao ?? null,
          periodos_ativos: row.periodos_ativos ?? null,
          entra_no_horario: row.entra_no_horario ?? null,
          avaliacao_mode: row.avaliacao_mode ?? null,
          avaliacao_disciplina_id: row.avaliacao_disciplina_id ?? null,
          modelo_avaliacao_id: row.modelo_avaliacao_id ?? null,
        },
        turma: {
          id: turmaRes.data?.id ?? turmaId,
          ano_letivo_id: turmaRes.data?.ano_letivo_id ?? null,
        },
        professor: { id: professorId, nome: profile?.nome ?? null, email: profile?.email ?? null },
        horarios: assignment?.horarios ?? null,
        planejamento: assignment?.planejamento ?? null,
        vinculos: {
          horarios: horarioOficialCount > 0,
          notas: notasCount > 0,
          presencas: (presencasCount ?? 0) > 0, // turma-level
          planejamento: hasPlanejamento,
        },
        counts: { rotinas: horarioOficialCount, notas: notasCount, presencas: presencasCount },
      })
    }

    return NextResponse.json({ ok: true, items, total: items.length, periodos }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
