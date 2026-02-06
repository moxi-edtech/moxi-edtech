import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { recordAuditServer } from '@/lib/audit'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    let partitionsQuery = (s as any).rpc('partitions_info')
    partitionsQuery = applyKf2ListInvariants(partitionsQuery, { defaultLimit: 50 })

    const { data, error: pErr } = await partitionsQuery
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

    const resolvedEscolaId = await resolveEscolaIdForUser(s as any, user.id, escolaId)
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    // Create partitions for next month
    const { error: e1 } = await (s as any).rpc('create_month_partition', { tbl: 'frequencias', month_start: (new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))).toISOString().slice(0,10) })
    const { error: e2 } = await (s as any).rpc('create_month_partition_ts', { tbl: 'lancamentos', month_start: (new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))).toISOString().slice(0,10) })
    if (e1 || e2) return NextResponse.json({ ok: false, error: (e1||e2).message }, { status: 500 })

    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'PARTITIONS_REFRESH',
      entity: 'maintenance',
      details: { tables: ['frequencias', 'lancamentos'] },
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
