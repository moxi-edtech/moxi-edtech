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
    const professorIds = Array.from(new Set((rows || []).map((r: any) => r.professor_id).filter(Boolean)))

    // Fetch disciplina names
    const [discRes, profRes, turmaRes] = await Promise.all([
      disciplinaIds.length
        ? supabase
          .from('curso_matriz')
          .select('id, disciplina_id, carga_horaria_semanal, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome), curriculo:curso_curriculos(id, status)')
          .in('id', disciplinaIds)
          .eq('escola_id', escolaId)
        : Promise.resolve({ data: [] as any[] }),
      professorIds.length
        ? supabase
          .from('professores')
          .select('id, profiles!professores_profile_id_fkey ( user_id, nome, email )')
          .in('id', professorIds)
          .eq('escola_id', escolaId)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('turmas')
        .select('id, ano_letivo_id')
        .eq('escola_id', escolaId)
        .eq('id', turmaId)
        .maybeSingle(),
    ])

    const { data: periodosRows } = turmaRes.data?.ano_letivo_id
      ? await supabase
          .from('periodos_letivos')
          .select('id, numero, dt_inicio, dt_fim')
          .eq('escola_id', escolaId)
          .eq('ano_letivo_id', turmaRes.data.ano_letivo_id)
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

    const profRowById = new Map<string, any>()
    for (const r of ((profRes as any).data || [])) profRowById.set(r.id, r)

    // Simple linkage checks per assignment (prefer FK columns when available)
    const periodos = (periodosRows ?? []).map((periodo: any) => ({
      id: periodo.id,
      numero: periodo.numero,
      dt_inicio: periodo.dt_inicio,
      dt_fim: periodo.dt_fim,
    }))

    const items = [] as any[]
    for (const row of rows || []) {
      const discInfo = discMap.get(row.curso_matriz_id)
      const disciplinaNome = discInfo?.nome ?? null
      const profRow = profRowById.get(row.professor_id)
      const profile = Array.isArray(profRow?.profiles) ? profRow?.profiles?.[0] : profRow?.profiles

      // Check notas: try disciplina_id FK first; fallback to disciplina (texto)
      let notasCount = 0
      if (row.curso_matriz_id) {
        const { data: notasRows } = await supabase
          .from('notas')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .eq('curso_matriz_id', row.curso_matriz_id)
          .limit(1)
        notasCount = (notasRows ?? []).length
      }

      // Check rotinas (horário) by turma and professor profile
      let rotinasCount = 0
      if (profile?.user_id) {
        const { data: rotinasRows } = await supabase
          .from('rotinas')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .eq('professor_user_id', profile.user_id)
          .limit(1)
        rotinasCount = (rotinasRows ?? []).length
      }

      // Check presenças: tenta filtrar por disciplina_id quando houver; senão, nível de turma
      let presencasCount = 0
      if (row.curso_matriz_id) {
        const { data: presencasRows } = await supabase
          .from('presencas')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .eq('curso_matriz_id', row.curso_matriz_id)
          .limit(1)
        presencasCount = (presencasRows ?? []).length
      } else {
        const { data: presencasRows } = await supabase
          .from('presencas')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .limit(1)
        presencasCount = (presencasRows ?? []).length
      }

      // Planejamento: placeholder (não há tabela unificada) – considerar future link com syllabi/planos
      const hasPlanejamento = false

      items.push({
        id: row.id,
        turma_id: row.turma_id,
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
        professor: { id: row.professor_id, nome: profile?.nome ?? null, email: profile?.email ?? null },
        horarios: null,
        planejamento: null,
        vinculos: {
          horarios: rotinasCount > 0,
          notas: notasCount > 0,
          presencas: (presencasCount ?? 0) > 0, // turma-level
          planejamento: hasPlanejamento,
        },
        counts: { rotinas: rotinasCount, notas: notasCount, presencas: presencasCount },
      })
    }

    return NextResponse.json({ ok: true, items, total: items.length, periodos }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
