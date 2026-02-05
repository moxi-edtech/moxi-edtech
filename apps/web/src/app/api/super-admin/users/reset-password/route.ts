import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    if (!userId) return NextResponse.json({ ok: false, error: 'userId ausente' }, { status: 400 })

    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const current = sess?.user
    if (!current) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', current.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (rows?.[0] as any)?.role as string | undefined
    if (role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    const { data: target } = await s
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle()

    const email = (target as any)?.email as string | undefined
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email do usuário não encontrado' }, { status: 404 })
    }

    const origin = new URL(request.url).origin
    const { error } = await s.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    recordAuditServer({
      escolaId: null,
      portal: 'super_admin',
      acao: 'RESET_PASSWORD_SOLICITADO',
      entity: 'usuario',
      entityId: userId,
      details: { email },
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao redefinir senha' },
      { status: 500 }
    )
  }
}
