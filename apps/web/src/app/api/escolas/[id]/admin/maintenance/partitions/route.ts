import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createAdminClient(url, key)

    const { data, error: pErr } = await (admin as any).rpc('partitions_info')
    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, partitions: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createAdminClient(url, key)

    // Create partitions for next month
    const { error: e1 } = await (admin as any).rpc('create_month_partition', { tbl: 'frequencias', month_start: (new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))).toISOString().slice(0,10) })
    const { error: e2 } = await (admin as any).rpc('create_month_partition_ts', { tbl: 'lancamentos', month_start: (new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))).toISOString().slice(0,10) })
    if (e1 || e2) return NextResponse.json({ ok: false, error: (e1||e2).message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
