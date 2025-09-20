import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  try {
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Somente super_admin
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

    // Tenta exclusão definitiva
    const delRes = await admin.from('escolas').delete().eq('id', escolaId)
    if (!delRes.error) {
      recordAuditServer({ escolaId, portal: 'super_admin', action: 'ESCOLA_DELETADA', entity: 'escola', entityId: escolaId }).catch(() => null)
      return NextResponse.json({ ok: true, mode: 'hard' })
    }

    // Se falhou (provável FK), marca como excluída (soft delete)
    console.warn('[super-admin] Hard delete falhou, aplicando soft delete:', delRes.error.message)
    const upRes = await admin.from('escolas').update({ status: 'excluida' as any }).eq('id', escolaId)
    if (!upRes.error) {
      recordAuditServer({ escolaId, portal: 'super_admin', action: 'ESCOLA_MARCADA_EXCLUSAO', entity: 'escola', entityId: escolaId, details: { reason: delRes.error.message } }).catch(() => null)
      return NextResponse.json({ ok: true, mode: 'soft' })
    }

    return NextResponse.json({ ok: false, error: delRes.error.message }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

