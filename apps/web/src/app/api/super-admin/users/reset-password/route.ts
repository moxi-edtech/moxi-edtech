import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
import { buildResetPasswordEmail, sendMail } from '@/lib/mailer'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    const providedPassword = String(body?.tempPassword || body?.password || '').trim()
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
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 })
    }

    const { data: target } = await s
      .from('profiles')
      .select('email, email_real')
      .eq('user_id', userId)
      .maybeSingle()

    const email = ((target as any)?.email_real || (target as any)?.email) as string | undefined
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email do usuário não encontrado' }, { status: 404 })
    }

    const isStrongPassword = (pwd: string) => {
      return (
        typeof pwd === 'string' &&
        pwd.length >= 8 &&
        /[A-Z]/.test(pwd) &&
        /[a-z]/.test(pwd) &&
        /\d/.test(pwd) &&
        /[^A-Za-z0-9]/.test(pwd)
      )
    }

    const generateStrongPassword = (len = 12) => {
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const lower = 'abcdefghijklmnopqrstuvwxyz'
      const nums = '0123456789'
      const special = '!@#$%^&*()-_=+[]{};:,.?'
      const all = upper + lower + nums + special
      const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
      let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
      for (let i = pwd.length; i < len; i++) pwd += pick(all)
      return pwd
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('')
    }

    if (providedPassword) {
      if (!isStrongPassword(providedPassword)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Senha temporária não atende aos requisitos: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
          },
          { status: 400 },
        )
      }

      await callAuthAdminJob(request, 'updateUserById', {
        userId,
        attributes: { password: providedPassword, email_confirm: true },
      })

      recordAuditServer({
        escolaId: null,
        portal: 'super_admin',
        acao: 'RESET_PASSWORD_FORCADO',
        entity: 'usuario',
        entityId: userId,
        details: { email },
      }).catch(() => null)

      return NextResponse.json({ ok: true, tempPassword: providedPassword, sentViaResend: false })
    }

    const origin = new URL(request.url).origin
    const redirectTo = `${origin}/reset-password`
    let sentViaResend = false
    try {
      const linkDataRaw = await callAuthAdminJob(request, 'generateLink', {
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      const linkData = linkDataRaw as { properties?: { action_link?: string | null }; action_link?: string | null } | null
      const actionLink = linkData?.properties?.action_link || linkData?.action_link || null
      if (actionLink) {
        const mail = buildResetPasswordEmail({ resetUrl: actionLink, expiresEm: '1 hora' })
        const sent = await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text })
        sentViaResend = sent.ok
      }
    } catch {
      sentViaResend = false
    }

    if (!sentViaResend) {
      const { error } = await s.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      }
    }

    recordAuditServer({
      escolaId: null,
      portal: 'super_admin',
      acao: 'RESET_PASSWORD_SOLICITADO',
      entity: 'usuario',
      entityId: userId,
      details: { email },
    }).catch(() => null)

    return NextResponse.json({ ok: true, sentViaResend, tempPassword: null })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao redefinir senha' },
      { status: 500 }
    )
  }
}
