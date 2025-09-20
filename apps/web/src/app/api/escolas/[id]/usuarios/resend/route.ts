import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { email } = parse.data

    // permission check via papel -> permission mapping
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'criar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const lower = email.toLowerCase()

    const { data: users, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 })
    const user = users?.users?.find(u => (u.email || '').toLowerCase() === lower)
    if (!user) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 })

    // resend only if not confirmed yet
    if (!user.email_confirmed_at) {
      const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(lower)
      if (inviteErr) return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 400 })
    }

    recordAuditServer({ escolaId, portal: 'admin_escola', action: 'USUARIO_REINVITE', entity: 'usuario', entityId: user.id, details: { email: lower } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
