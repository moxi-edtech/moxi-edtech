import { NextResponse } from 'next/server'
import { supabaseRouteClient } from '@/lib/supabaseServer'
import { headers } from 'next/headers'
import { PayloadLimitError, readJsonWithLimit } from '@/lib/http/readJsonWithLimit'
import type { Database } from '~types/supabase'

const AUDIT_MAX_JSON_BYTES = 64 * 1024; // 64KB

export async function POST(req: Request) {
  try {
    const body = await readJsonWithLimit(req, { maxBytes: AUDIT_MAX_JSON_BYTES }) as Record<string, unknown>
    let escolaId = typeof body.escolaId === "string" ? body.escolaId : null
    const portal = typeof body.portal === "string" ? body.portal : "outro"
    const acao = typeof body.acao === "string" ? body.acao : ""
    const entity = typeof body.entity === "string" ? body.entity : ""
    const entityId = typeof body.entityId === "string" ? body.entityId : null
    const details = (body.details && typeof body.details === "object" ? body.details : {}) as Database["public"]["Tables"]["audit_logs"]["Insert"]["details"]

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

    if (!escolaId) {
      const { data: profile } = await s
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .maybeSingle();
      escolaId = (profile?.current_escola_id as string | null) ?? (profile?.escola_id as string | null) ?? null;
    }
    
    // IP and User Agent detection
    const ip = h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown'
    const ua = h.get('user-agent') || 'unknown'

    const payload: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
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
      // Auditoria não deve derrubar o fluxo principal da UI.
      return NextResponse.json({ ok: false, skipped: true, error: error.message })
    }

    return NextResponse.json({ ok: true, skipped: false })
  } catch (err) {
    if (err instanceof PayloadLimitError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Audit API] Unexpected error:', message)
    // Evita erro 500 no cliente por falha de telemetria.
    return NextResponse.json({ ok: false, skipped: true, error: message })
  }
}
