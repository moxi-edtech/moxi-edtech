import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'

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

    const { data: tdp, error } = await supabase
      .from('turma_disciplinas_professores')
      .select('id, turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .in('professor_id', (
        await supabase.from('professores').select('id').eq('profile_id', user.id)
      ).data?.map((r: any) => r.id) || [] )

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const turmaIds = Array.from(new Set((tdp || []).map((r: any) => r.turma_id).filter(Boolean)))
    const discIds = Array.from(new Set((tdp || []).map((r: any) => r.disciplina_id).filter(Boolean)))

    const [turmasRes, discsRes] = await Promise.all([
      turmaIds.length ? supabase.from('turmas').select('id, nome').in('id', turmaIds) : Promise.resolve({ data: [] as any[] }),
      discIds.length ? supabase.from('disciplinas').select('id, nome').in('id', discIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const turmaMap = new Map<string, string>(); for (const t of (turmasRes as any).data || []) turmaMap.set(t.id, t.nome)
    const discMap = new Map<string, string>(); for (const d of (discsRes as any).data || []) discMap.set(d.id, d.nome)

    const items = (tdp || []).map((r: any) => ({
      id: r.id,
      turma: { id: r.turma_id, nome: turmaMap.get(r.turma_id) || null },
      disciplina: { id: r.disciplina_id, nome: discMap.get(r.disciplina_id) || null },
    }))
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

