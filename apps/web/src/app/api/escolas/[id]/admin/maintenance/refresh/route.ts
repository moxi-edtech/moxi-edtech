import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { hasPermission } from '@/lib/permissions'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Must be admin of this escola
    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    // Service role client to refresh MVs
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createAdminClient(url, key)
    const { error } = await admin.rpc('refresh_all_materialized_views')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

