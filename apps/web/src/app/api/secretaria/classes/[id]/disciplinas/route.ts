import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'

// GET /api/secretaria/classes/:id/disciplinas
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: classeId } = await ctx.params

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
        .from('escola_users')
        .select('escola_id')
        .eq('user_id', user.id)
        .limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const { data, error } = await supabase
      .from('disciplinas')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .eq('classe_id', classeId)
      .order('nome')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, items: data || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

