import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const [{ data: profile }, { data: escola }] = await Promise.all([
      supabase
        .from('profiles')
        .select('nome')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('escolas')
        .select('nome')
        .eq('id', escolaId)
        .maybeSingle(),
    ])

    const nomeCompleto = String(profile?.nome || '').trim()
    const primeiroNome = nomeCompleto ? nomeCompleto.split(' ')[0] : null

    return NextResponse.json({
      ok: true,
      escola_nome: escola?.nome ?? null,
      primeiro_nome: primeiroNome,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
