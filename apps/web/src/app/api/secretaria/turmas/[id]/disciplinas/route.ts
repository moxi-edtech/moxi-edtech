import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser, authorizeTurmasManage } from '@/lib/escola/disciplinas'

// GET /api/secretaria/turmas/:id/disciplinas
// Returns assigned disciplinas for a turma with professor info and simple linkage checks
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId } = await ctx.params

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 }, { headers })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`)

    // Load assignments
    const { data: rows, error } = await supabase
      .from('turma_disciplinas_professores')
      .select('id, turma_id, disciplina_id, professor_id, horarios, planejamento')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })

    const disciplinaIds = Array.from(new Set((rows || []).map((r: any) => r.disciplina_id).filter(Boolean)))
    const professorIds = Array.from(new Set((rows || []).map((r: any) => r.professor_id).filter(Boolean)))

    // Fetch disciplina names
    const [discRes, profRes] = await Promise.all([
      disciplinaIds.length
        ? supabase.from('disciplinas').select('id, nome').in('id', disciplinaIds)
        : Promise.resolve({ data: [] as any[] }),
      professorIds.length
        ? supabase.from('professores').select('id, profile_id').in('id', professorIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const discMap = new Map<string, string>()
    for (const d of (discRes as any).data || []) discMap.set(d.id, d.nome)

    // Load profiles for professores
    const profileIds = Array.from(
      new Set(((profRes as any).data || []).map((p: any) => p.profile_id).filter(Boolean))
    )
    const { data: profiles } = profileIds.length
      ? await supabase.from('profiles').select('user_id, nome, email').in('user_id', profileIds)
      : { data: [] as any[] }
    const profByProfile = new Map<string, { nome: string | null; email: string | null }>()
    for (const p of profiles || []) profByProfile.set(p.user_id, { nome: p.nome ?? null, email: p.email ?? null })
    const profRowById = new Map<string, any>()
    for (const r of ((profRes as any).data || [])) profRowById.set(r.id, r)

    // Simple linkage checks per assignment (prefer FK columns when available)
    const items = [] as any[]
    for (const row of rows || []) {
      const disciplinaNome = discMap.get(row.disciplina_id) || null
      const profRow = profRowById.get(row.professor_id)
      const profile = profRow ? profByProfile.get(profRow.profile_id) : undefined

      // Check notas: try disciplina_id FK first; fallback to disciplina (texto)
      let notasCount = 0
      if (row.disciplina_id) {
        const { count } = await supabase
          .from('notas')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turmaId)
          .eq('disciplina_id', row.disciplina_id)
        notasCount = count ?? 0
      } else if (disciplinaNome) {
        const { count } = await supabase
          .from('notas')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turmaId)
          .eq('disciplina', disciplinaNome)
        notasCount = count ?? 0
      }

      // Check rotinas (horário) by turma and professor profile
      let rotinasCount = 0
      if (profRow?.profile_id) {
        const { count } = await supabase
          .from('rotinas')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turmaId)
          .eq('professor_user_id', profRow.profile_id)
        rotinasCount = count ?? 0
      }

      // Check presenças: tenta filtrar por disciplina_id quando houver; senão, nível de turma
      let presencasCount = 0
      if (row.disciplina_id) {
        const { count } = await supabase
          .from('presencas')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turmaId)
          .eq('disciplina_id', row.disciplina_id)
        presencasCount = count ?? 0
      } else {
        const { count } = await supabase
          .from('presencas')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turmaId)
        presencasCount = count ?? 0
      }

      // Planejamento: placeholder (não há tabela unificada) – considerar future link com syllabi/planos
      const hasPlanejamento = Boolean(row.planejamento && Object.keys(row.planejamento || {}).length > 0)

      items.push({
        id: row.id,
        turma_id: row.turma_id,
        disciplina: { id: row.disciplina_id, nome: disciplinaNome },
        professor: { id: row.professor_id, nome: profile?.nome ?? null, email: profile?.email ?? null },
        horarios: row.horarios ?? null,
        planejamento: row.planejamento ?? null,
        vinculos: {
          horarios: rotinasCount > 0,
          notas: notasCount > 0,
          presencas: (presencasCount ?? 0) > 0, // turma-level
          planejamento: hasPlanejamento,
        },
        counts: { rotinas: rotinasCount, notas: notasCount, presencas: presencasCount },
      })
    }

    return NextResponse.json({ ok: true, items, total: items.length }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
