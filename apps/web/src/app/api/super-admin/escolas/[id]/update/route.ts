import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'

const BodySchema = z.object({
  aluno_portal_enabled: z.boolean().optional(),
  plano: z.enum(['basico','standard','premium']).optional(),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const body = await req.json()
    const parse = BodySchema.safeParse(body)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const updates = parse.data

    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // super_admin only
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })

    const patch: Record<string, any> = {}
    if (typeof updates.aluno_portal_enabled === 'boolean') patch.aluno_portal_enabled = updates.aluno_portal_enabled
    if (updates.plano) patch.plano = updates.plano
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })

    const sAny = s as any
    const { error } = await sAny.from('escolas').update(patch).eq('id', escolaId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    // Auditoria
    recordAuditServer({ escolaId, portal: 'super_admin', action: 'ESCOLA_ATUALIZADA', entity: 'escola', entityId: escolaId, details: patch }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
