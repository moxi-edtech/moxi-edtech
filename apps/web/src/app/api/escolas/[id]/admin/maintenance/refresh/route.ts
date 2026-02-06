import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { recordAuditServer } from '@/lib/audit'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId)
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Must be admin of this escola
    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const { error } = await s.rpc('refresh_all_materialized_views')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'MV_REFRESH_ALL',
      entity: 'maintenance',
      details: { rpc: 'refresh_all_materialized_views' },
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
