import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { createServiceRoleClient, invalidateTenantConfig } from '@moxi/tenant-sdk'

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

    const { enabled } = await req.json()
    const admin = createServiceRoleClient()
    const { error } = await admin.from('escolas').update({ use_mv_dashboards: !!enabled }).eq('id', escolaId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // Keep cached tenant configuration aligned with updates from this route
    invalidateTenantConfig(escolaId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

