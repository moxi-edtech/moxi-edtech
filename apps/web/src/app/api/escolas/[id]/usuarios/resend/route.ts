import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteClient } from '@/lib/supabase/route-client'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
import { buildInviteEmail, sendMail } from '@/lib/mailer'

const BodySchema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const { email } = parse.data

    // permission check via papel -> permission mapping
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase.from('escola_users').select('papel').eq('user_id', requesterId).eq('escola_id', userEscolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'criar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    const { data: profCheck } = await supabase.from('profiles' as any).select('escola_id').eq('user_id', requesterId).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== userEscolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })
    const lower = email.toLowerCase()

    const list = await callAuthAdminJob(req, 'listUsers', { page: 1, perPage: 1000 })
    const user = list?.users?.find((u: any) => (u.email || '').toLowerCase() === lower)
    if (!user) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 })

    let emailStatus: { attempted: boolean; ok: boolean; error?: string | null; via?: 'resend' | 'supabase' } = { attempted: false, ok: true }

    // resend only if not confirmed yet
    if (!user.email_confirmed_at) {
      const origin = new URL(req.url).origin
      const redirectTo = `${origin}/reset-password`
      let actionLink: string | null = null
      try {
        const linkDataRaw = await callAuthAdminJob(req, 'generateLink', {
          type: 'invite',
          email: lower,
          options: { redirectTo },
        })
        const linkData = linkDataRaw as { properties?: { action_link?: string | null }; action_link?: string | null } | null
        actionLink = linkData?.properties?.action_link || linkData?.action_link || null
      } catch {}

      try {
        const { data: escolaRow } = await supabase
          .from('escolas')
          .select('nome')
          .eq('id', userEscolaId)
          .maybeSingle()
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('nome')
          .eq('user_id', user.id)
          .maybeSingle()
        const { data: membershipRow } = await supabase
          .from('escola_users')
          .select('papel')
          .eq('escola_id', userEscolaId)
          .eq('user_id', user.id)
          .maybeSingle()
        const escolaNome = (escolaRow as any)?.nome ?? 'sua escola'
        const adminNome = (profileRow as any)?.nome ?? undefined
        const papel = (membershipRow as any)?.papel ?? null
        const { subject, html, text } = buildInviteEmail({
          escolaNome,
          onboardingUrl: actionLink || redirectTo,
          convidadoEmail: lower,
          convidadoNome: adminNome,
          papel,
        })
        const sent = await sendMail({ to: lower, subject, html: String(html), text: String(text) })
        emailStatus = { attempted: true, ok: sent.ok, error: sent.ok ? null : sent.error, via: 'resend' }
      } catch (error) {
        emailStatus = { attempted: true, ok: false, error: error instanceof Error ? error.message : String(error), via: 'resend' }
      }

      if (!emailStatus.ok) {
        await callAuthAdminJob(req, 'inviteUserByEmail', { email: lower, options: { redirectTo } })
        emailStatus = { attempted: true, ok: true, via: 'supabase' }
      }
    }

    recordAuditServer({ escolaId: userEscolaId, portal: 'admin_escola', acao: 'USUARIO_REINVITE', entity: 'usuario', entityId: user.id, details: { email: lower, emailStatus } }).catch(() => null)
    return NextResponse.json({ ok: true, emailStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
