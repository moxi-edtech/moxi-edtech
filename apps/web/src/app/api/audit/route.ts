import { NextResponse } from 'next/server'
import { supabaseRouteClient } from '@/lib/supabaseServer'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { escolaId, portal, acao, entity, entityId, details } = body

    if (!entity || !acao) {
      return NextResponse.json({ ok: false, error: 'Missing entity or acao' }, { status: 400 })
    }

    const s = await supabaseRouteClient()
    const h = await headers()
    
    // Auth context
    const { data: { user } } = await s.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }
    
    // IP and User Agent detection
    const ip = h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown'
    const ua = h.get('user-agent') || 'unknown'

    const payload = {
      escola_id: escolaId || null,
      portal: portal || 'outro',
      acao: acao,
      action: acao,
      tabela: entity,
      entity: entity,
      entity_id: entityId || null,
      details: details || {},
      user_id: user.id,
      actor_id: user.id,
      ip: ip,
      user_agent: ua
    }

    const { error } = await s.from('audit_logs').insert(payload)
    
    if (error) {
      console.error('[Audit API] Error inserting log:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Audit API] Unexpected error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
