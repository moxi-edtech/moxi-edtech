import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import { buildOnboardingEmail, sendMail } from "@/lib/mailer"
import { recordAuditServer } from "@/lib/audit"
import { parsePlanTier } from "@/config/plans"
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  try {
    const s = await supabaseServer()
    const { data: { session } } = await s.auth.getSession()
    const user = session?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const role = (prof?.[0] as any)?.role || null
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })
    }

    const url = new URL(req.url)
    const origin = url.origin
    // Centralized redirect to decide destination after auth
    const redirectTo = `${origin}/redirect`

    // Fetch escola info
    const { data: esc } = await (s as any).from('escolas').select('nome, plano_atual, plano, status').eq('id', escolaId).limit(1)
    const escolaNome = (esc?.[0] as any)?.nome || ''
    const escolaPlanoRaw = (esc?.[0] as any)?.plano_atual ?? (esc?.[0] as any)?.plano ?? null
    const escolaPlano = escolaPlanoRaw ? parsePlanTier(escolaPlanoRaw) : null
    const escolaStatus = (esc?.[0] as any)?.status as string | undefined
    if (escolaStatus === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite reenviar convite.' }, { status: 400 })
    if (escolaStatus === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para reenviar convite.' }, { status: 400 })

    // Resolve first admin for the school
    const { data: vinc } = await (s as any)
      .from('escola_users')
      .select('user_id,papel')
      .eq('escola_id', escolaId)
      .in('papel', ['admin','staff_admin'] as any)
      .limit(1)
    const uid = (vinc?.[0] as any)?.user_id as string | undefined
    if (!uid) return NextResponse.json({ ok: false, error: 'Nenhum administrador vinculado à escola.' }, { status: 400 })

    const { data: p } = await (s as any).from('profiles').select('email, nome').eq('user_id', uid).limit(1)
    const adminEmail = (p?.[0] as any)?.email as string | undefined
    const adminNome = (p?.[0] as any)?.nome as string | undefined
    if (!adminEmail) return NextResponse.json({ ok: false, error: 'Não foi possível determinar o e-mail do admin.' }, { status: 400 })

    const actionLink = `${origin}/login`
    const { subject, html, text } = buildOnboardingEmail({
      escolaNome: escolaNome || 'sua escola',
      onboardingUrl: actionLink,
      adminEmail,
      adminNome: adminNome || undefined,
      plano: escolaPlano || undefined,
    })
    // TODO: buildOnboardingEmail html/text are incorrectly inferred as Promise<string>. Hotfix with `as any`.
    const sent = await sendMail({ to: adminEmail, subject, html: html as any, text: text as any })
    const mensagem = sent.ok
      ? '✉️ E-mail reenviado com instruções.'
      : '⚠️ Falha no envio do e-mail.'
    let errorMessage: string | null = null
    if (!sent.ok) {
      errorMessage = sent.error
    }

    recordAuditServer({
      escolaId,
      portal: 'super_admin',
      acao: 'REENVIAR_CONVITE',
      entity: 'escola',
      entityId: escolaId,
      details: { adminEmail, ok: sent.ok },
    }).catch(() => null)

    return NextResponse.json({
      ok: sent.ok,
      mensagem,
      actionLink,
      emailStatus: { attempted: true, via: 'custom', ok: sent.ok, error: errorMessage },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
