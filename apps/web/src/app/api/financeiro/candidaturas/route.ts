import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'
import { applyKf2ListInvariants } from '@/lib/kf2'

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    let query = supabase
      .from('candidaturas')
      .select('id, nome_candidato, curso_id, classe_id, turma_preferencial_id, status, created_at, dados_candidato, cursos(nome)')
      .eq('escola_id', escolaId)
      .in('status', ['pendente', 'aguardando_compensacao'])
      .order('created_at', { ascending: false })

    query = applyKf2ListInvariants(query, { defaultLimit: 50 })

    const { data, error } = await query

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, items: data || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
