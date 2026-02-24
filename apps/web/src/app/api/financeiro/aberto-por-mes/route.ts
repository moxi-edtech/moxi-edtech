import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

// Totais em aberto por mês, com base na view vw_total_em_aberto_por_mes
export async function GET() {
  try {
    const s = await supabaseServerTyped<Database>()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const metaEscolaId =
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
    const escolaId = await resolveEscolaIdForUser(
      s,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    )
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Perfil sem escola vinculada' }, { status: 400 })
    }

    let query = s
      .from('vw_total_em_aberto_por_mes')
      .select('ano, mes, total_aberto')
      .eq('escola_id', escolaId)
      .order('ano', { ascending: true })
      .order('mes', { ascending: true })

    query = applyKf2ListInvariants(query)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
