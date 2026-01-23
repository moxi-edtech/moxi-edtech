import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'

// GET /api/professor/atribuicoes
// Lista atribuições (turma, disciplina) para o professor logado
export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve escola ativa
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const escolaId = ((prof as any)?.current_escola_id || (prof as any)?.escola_id) as string | undefined
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    let query = supabase
      .from('turma_disciplinas')
      .select('id, turma_id, curso_matriz_id')
      .eq('escola_id', escolaId)
      .in('professor_id', (
        await supabase.from('professores').select('id').eq('profile_id', user.id).eq('escola_id', escolaId)
      ).data?.map((r: any) => r.id) || [] )

    query = applyKf2ListInvariants(query, { defaultLimit: 200 })

    const { data: tdp, error } = await query

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const turmaIds = Array.from(new Set((tdp || []).map((r: any) => r.turma_id).filter(Boolean)))
    const matrizIds = Array.from(new Set((tdp || []).map((r: any) => r.curso_matriz_id).filter(Boolean)))

    const [turmasRes, matrizRes] = await Promise.all([
      turmaIds.length
        ? supabase
            .from('turmas')
            .select('id, nome')
            .in('id', turmaIds)
            .eq('escola_id', escolaId)
        : Promise.resolve({ data: [] as any[] }),
      matrizIds.length
        ? supabase
            .from('curso_matriz')
            .select('id, disciplina_id, disciplina:disciplinas_catalogo(id, nome)')
            .in('id', matrizIds)
            .eq('escola_id', escolaId)
        : Promise.resolve({ data: [] as any[] }),
    ])
    const turmaMap = new Map<string, string>();
    for (const t of (turmasRes as any).data || []) turmaMap.set(t.id, t.nome)

    const matrizMap = new Map<string, { disciplinaId: string | null; disciplinaNome: string | null }>();
    for (const d of (matrizRes as any).data || []) {
      matrizMap.set(d.id, {
        disciplinaId: d.disciplina_id ?? (d as any)?.disciplina?.id ?? null,
        disciplinaNome: (d as any)?.disciplina?.nome ?? null,
      })
    }

    const items = (tdp || []).map((r: any) => {
      const matriz = matrizMap.get(r.curso_matriz_id) || { disciplinaId: null, disciplinaNome: null }
      return {
        id: r.id,
        turma_disciplina_id: r.id,
        curso_matriz_id: r.curso_matriz_id,
        turma: { id: r.turma_id, nome: turmaMap.get(r.turma_id) || null },
        disciplina: { id: matriz.disciplinaId, nome: matriz.disciplinaNome },
      }
    })
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
