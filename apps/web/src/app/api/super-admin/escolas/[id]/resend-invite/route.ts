import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "~types/supabase"
import { buildOnboardingEmail, sendMail } from "@/lib/mailer"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  try {
    const s = await supabaseServer()
    const { data: { session } } = await s.auth.getSession()
    const user = session?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (prof?.[0] as any)?.role || null
    if (role !== 'super_admin') return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })

    const hasAdmin = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!hasAdmin) return NextResponse.json({ ok: false, error: 'Configuração Supabase ausente' }, { status: 500 })
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const url = new URL(req.url)
    const origin = url.origin
    // Centralized redirect to decide destination after auth
    const redirectTo = `${origin}/redirect`

    // Fetch escola info
    const { data: esc } = await admin.from('escolas').select('nome, plano, status').eq('id', escolaId).limit(1)
    const escolaNome = (esc?.[0] as any)?.nome || ''
    const escolaPlano = (esc?.[0] as any)?.plano || null
    const escolaStatus = (esc?.[0] as any)?.status as string | undefined
    if (escolaStatus === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite reenviar convite.' }, { status: 400 })
    if (escolaStatus === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para reenviar convite.' }, { status: 400 })

    // Resolve first admin for the school
    const { data: vinc } = await admin
      .from('escola_usuarios')
      .select('user_id,papel')
      .eq('escola_id', escolaId)
      .in('papel', ['admin','staff_admin'] as any)
      .limit(1)
    const uid = (vinc?.[0] as any)?.user_id as string | undefined
    if (!uid) return NextResponse.json({ ok: false, error: 'Nenhum administrador vinculado à escola.' }, { status: 400 })

    const { data: p } = await admin.from('profiles').select('email, nome').eq('user_id', uid).limit(1)
    const adminEmail = (p?.[0] as any)?.email as string | undefined
    const adminNome = (p?.[0] as any)?.nome as string | undefined
    if (!adminEmail) return NextResponse.json({ ok: false, error: 'Não foi possível determinar o e-mail do admin.' }, { status: 400 })

    // Generate action link
    let actionLink: string | null = null
    try {
      const { data: linkData } = await (admin as any).auth.admin.generateLink({
        type: 'invite',
        email: adminEmail,
        options: { redirectTo }
      })
      actionLink = (linkData?.properties?.action_link || linkData?.action_link || null) as string | null
    } catch {
      actionLink = null
    }

    let mensagem = ''
    let emailStatus: { attempted: boolean; via: 'custom' | 'supabase-invite' | 'supabase-magic' | null; ok: boolean; error?: string } = { attempted: false, via: null, ok: false }

    if (actionLink) {
      const { subject, html, text } = buildOnboardingEmail({ escolaNome: escolaNome || 'sua escola', onboardingUrl: actionLink, adminEmail, adminNome: adminNome || undefined, plano: escolaPlano || undefined })
      const sent = await sendMail({ to: adminEmail, subject, html, text })
      if (sent.ok) {
        mensagem = '✉️ E-mail reenviado com instruções (SMTP/Resend).'
        emailStatus = { attempted: true, via: 'custom', ok: true }
      } else {
        mensagem = '⚠️ Falha no envio personalizado; tentando fallback do Supabase.'
        // Tenta fallback mesmo quando actionLink foi gerado
        const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(adminEmail, { redirectTo })
        if (inviteErr) {
          mensagem += ' ⚠️ Falha no envio de convite (fallback).'
          emailStatus = { attempted: true, via: 'supabase-invite', ok: false, error: inviteErr.message }
        } else {
          mensagem += ' ✉️ Convite reenviado (fallback) para iniciar o onboarding.'
          emailStatus = { attempted: true, via: 'supabase-invite', ok: true }
        }
      }
    }

    if (!actionLink) {
      const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(adminEmail, { redirectTo })
      if (inviteErr) {
        mensagem = '⚠️ Falha no envio de convite (fallback).'
        emailStatus = { attempted: true, via: 'supabase-invite', ok: false, error: inviteErr.message }
      } else {
        mensagem = '✉️ Convite reenviado (fallback) para iniciar o onboarding.'
        emailStatus = { attempted: true, via: 'supabase-invite', ok: true }
      }
    }

    return NextResponse.json({ ok: true, mensagem, actionLink: actionLink || redirectTo, emailStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
