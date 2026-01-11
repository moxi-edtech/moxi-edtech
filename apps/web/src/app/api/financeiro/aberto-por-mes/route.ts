import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'

// Totais em aberto por mês, com base na view v_total_em_aberto_por_mes
export async function GET() {
  try {
    const s = await supabaseServer()
    let query = s
      .from('v_total_em_aberto_por_mes')
      .select('ano, mes, total_aberto')
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
