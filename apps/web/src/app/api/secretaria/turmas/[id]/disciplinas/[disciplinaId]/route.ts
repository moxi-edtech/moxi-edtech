import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'

// DELETE /api/secretaria/turmas/:id/disciplinas/:disciplinaId
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; disciplinaId: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId, disciplinaId } = await ctx.params

    // Resolve escola
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await supabase
        .from('escola_usuarios')
        .select('escola_id')
        .eq('user_id', user.id)
        .limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const { error } = await supabase
      .from('turma_disciplinas_professores')
      .delete()
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', disciplinaId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

