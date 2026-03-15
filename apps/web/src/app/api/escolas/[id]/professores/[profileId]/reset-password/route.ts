import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { hasPermission, normalizePapel } from '@/lib/permissions'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
import { buildCredentialsEmail, sendMail } from '@/lib/mailer'

const generateStrongPassword = (len = 12) => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const special = '!@#$%^&*()-_=+[]{};:,.?'
  const all = upper + lower + nums + special
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
  for (let i = pwd.length; i < len; i++) pwd += pick(all)
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; profileId: string }> }) {
  const { id: escolaId, profileId } = await context.params

  try {
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as any)?.role)
    if (!hasPermission(papelReq, 'editar_usuario')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const tempPassword = generateStrongPassword(12)

    await callAuthAdminJob(req, 'updateUserById', {
      userId: profileId,
      attributes: { password: tempPassword, user_metadata: { must_change_password: true } },
    })

    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email, nome, escola_id')
        .eq('user_id', profileId)
        .maybeSingle()
      const email = (prof as any)?.email as string | undefined
      if (email) {
        const escolaIdTarget = (prof as any)?.escola_id as string | null
        const { data: escola } = await supabase
          .from('escolas')
          .select('nome')
          .eq('id', escolaIdTarget || escolaId)
          .maybeSingle()
        const escolaNome = (escola as any)?.nome ?? null
        const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : null
        const mail = buildCredentialsEmail({
          nome: (prof as any)?.nome ?? null,
          email,
          senha_temp: tempPassword,
          escolaNome,
          loginUrl,
        })
        await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text })
      }
    } catch {}

    return NextResponse.json({ ok: true, senha_temp: tempPassword })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
