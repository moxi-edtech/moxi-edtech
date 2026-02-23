import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/professor/atribuicoes
// Lista atribuições (turma, disciplina) para o professor logado
export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve escola ativa
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const admin = getSupabaseServerClient()
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 500 })
    }

    const { data: professor } = await admin
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()

    const professorId = (professor as any)?.id as string | undefined
    if (!professorId) return NextResponse.json({ ok: true, escola_id: escolaId, items: [] })

    let query = admin
      .from('turma_disciplinas')
      .select('id, turma_id, curso_matriz_id, curso_matriz:curso_matriz!turma_disciplinas_curso_matriz_id_fkey(id, disciplina_id, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome))')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)

    query = applyKf2ListInvariants(query, { defaultLimit: 50 })

    const { data: tdp, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const { data: legacyAssignments } = await admin
      .from('turma_disciplinas_professores')
      .select('turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', professorId)

    const turmaIdsFromTdp = (tdp || []).map((r: any) => r.turma_id).filter(Boolean)
    const turmaIdsFromLegacy = (legacyAssignments || []).map((r: any) => r.turma_id).filter(Boolean)
    const turmaIds = Array.from(new Set([...turmaIdsFromTdp, ...turmaIdsFromLegacy]))

    const turmaMetaRows = turmaIds.length
      ? await admin
          .from('turmas')
          .select('id, nome, curso_id, classe_id, status_fecho')
          .in('id', turmaIds)
          .eq('escola_id', escolaId)
      : { data: [] as any[] }

    const turmaMeta = (turmaMetaRows as any).data || []
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
      new Set((legacyAssignments || []).map((r: any) => r.disciplina_id).filter(Boolean))
    )
    const classeIds = Array.from(new Set(turmaMeta.map((t: any) => t.classe_id).filter(Boolean)))

    const matrizRows = disciplinaIds.length && classeIds.length
      ? await admin
          .from('curso_matriz')
          .select('id, curso_id, classe_id, disciplina_id, disciplina:disciplinas_catalogo(id, nome)')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .in('disciplina_id', disciplinaIds)
          .in('classe_id', classeIds)
      : { data: [] as any[] }

    const matrizByKey = new Map<string, { id: string; disciplinaId: string | null; disciplinaNome: string | null }>()
    for (const row of (matrizRows as any).data || []) {
      const key = `${row.curso_id}:${row.classe_id}:${row.disciplina_id}`
      matrizByKey.set(key, {
        id: row.id,
        disciplinaId: row.disciplina_id ?? (row as any)?.disciplina?.id ?? null,
        disciplinaNome: (row as any)?.disciplina?.nome ?? null,
      })
    }

    const legacyMatrizIds = new Set<string>()
    const legacyResolved = (legacyAssignments || [])
      .map((row: any) => {
        const turmaInfo = turmaMap.get(row.turma_id)
        if (!turmaInfo?.curso_id || !turmaInfo?.classe_id) return null
        const key = `${turmaInfo.curso_id}:${turmaInfo.classe_id}:${row.disciplina_id}`
        const matriz = matrizByKey.get(key)
        if (!matriz?.id) return null
        legacyMatrizIds.add(matriz.id)
        return {
          turma_id: row.turma_id,
          curso_matriz_id: matriz.id,
        }
      })
      .filter(Boolean) as Array<{ turma_id: string; curso_matriz_id: string }>

    const legacyTurmaIds = Array.from(new Set(legacyResolved.map((r) => r.turma_id)))
    const legacyMatrizIdList = Array.from(legacyMatrizIds)

    const turmaDisciplinaRows = legacyTurmaIds.length && legacyMatrizIdList.length
      ? await admin
          .from('turma_disciplinas')
          .select('id, turma_id, curso_matriz_id')
          .eq('escola_id', escolaId)
          .in('turma_id', legacyTurmaIds)
          .in('curso_matriz_id', legacyMatrizIdList)
      : { data: [] as any[] }

    const turmaDisciplinaMap = new Map<string, { id: string; turma_id: string; curso_matriz_id: string }>()
    for (const row of (turmaDisciplinaRows as any).data || []) {
      turmaDisciplinaMap.set(`${row.turma_id}:${row.curso_matriz_id}`, row)
    }

    const merged = new Map<string, { id: string; turma_id: string; curso_matriz_id: string; disciplina_id?: string | null; disciplina_nome?: string | null }>()
    for (const row of (tdp || []) as any[]) {
      if (!row?.turma_id || !row?.curso_matriz_id) continue
      merged.set(`${row.turma_id}:${row.curso_matriz_id}`, {
        id: row.id,
        turma_id: row.turma_id,
        curso_matriz_id: row.curso_matriz_id,
        disciplina_id: row?.curso_matriz?.disciplina_id ?? row?.curso_matriz?.disciplina?.id ?? null,
        disciplina_nome: row?.curso_matriz?.disciplina?.nome ?? null,
      })
    }

    for (const row of legacyResolved) {
      const key = `${row.turma_id}:${row.curso_matriz_id}`
      const turmaDisciplina = turmaDisciplinaMap.get(key)
      if (!turmaDisciplina) continue
      if (!merged.has(key)) {
        merged.set(key, {
          id: turmaDisciplina.id,
          turma_id: turmaDisciplina.turma_id,
          curso_matriz_id: turmaDisciplina.curso_matriz_id,
        })
      }
    }

    const mergedRows = Array.from(merged.values())
    const matrizIds = Array.from(new Set(mergedRows.map((r) => r.curso_matriz_id).filter(Boolean)))

    const matrizRes = matrizIds.length
      ? await admin
          .from('curso_matriz')
          .select('id, disciplina_id, disciplina:disciplinas_catalogo(id, nome)')
          .in('id', matrizIds)
          .eq('escola_id', escolaId)
      : { data: [] as any[] }

    const matrizMap = new Map<string, { disciplinaId: string | null; disciplinaNome: string | null }>()
    for (const d of (matrizRes as any).data || []) {
      matrizMap.set(d.id, {
        disciplinaId: d.disciplina_id ?? (d as any)?.disciplina?.id ?? null,
        disciplinaNome: (d as any)?.disciplina?.nome ?? null,
      })
    }

    const items = mergedRows.map((r: any) => {
      const matriz = matrizMap.get(r.curso_matriz_id) || {
        disciplinaId: r.disciplina_id ?? null,
        disciplinaNome: r.disciplina_nome ?? null,
      }
      const turmaInfo = turmaMap.get(r.turma_id)
      return {
        id: r.id,
        turma_disciplina_id: r.id,
        curso_matriz_id: r.curso_matriz_id,
        turma: { id: r.turma_id, nome: turmaInfo?.nome ?? null, status_fecho: turmaInfo?.status_fecho ?? null },
        disciplina: { id: matriz.disciplinaId, nome: matriz.disciplinaNome },
      }
    })
    return NextResponse.json({ ok: true, escola_id: escolaId, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
