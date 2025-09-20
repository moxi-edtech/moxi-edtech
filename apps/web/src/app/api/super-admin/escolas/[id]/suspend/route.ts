import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  try {
    let motivo: string | null = null
    try {
      const body = await req.json().catch(() => null) as any
      motivo = body?.motivo ? String(body.motivo) : null
    } catch {}

    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Somente super_admin
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    const sAny = s as any
    const { error } = await sAny.from('escolas').update({ status: 'suspensa' }).eq('id', escolaId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'super_admin', action: 'ESCOLA_SUSPENSA', entity: 'escola', entityId: escolaId, details: { status: 'suspensa', motivo: motivo || undefined } }).catch(() => null)

    return NextResponse.json({ ok: true, status: 'suspensa' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
