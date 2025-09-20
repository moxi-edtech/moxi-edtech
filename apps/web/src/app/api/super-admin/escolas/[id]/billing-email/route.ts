import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { buildBillingEmail, sendMail } from '@/lib/mailer'
import { recordAuditServer } from '@/lib/audit'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    // Dados da escola
    const { data: esc } = await admin.from('escolas').select('nome,status').eq('id', escolaId).limit(1)
    const escolaNome = (esc?.[0] as any)?.nome || 'sua escola'
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite cobrança.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para enviar cobranças.' }, { status: 400 })

    // Destinatários: papel financeiro; fallback para admin/staff_admin
    const { data: finUsers } = await admin
      .from('escola_usuarios')
      .select('user_id,papel')
      .eq('escola_id', escolaId)
      .in('papel', ['financeiro'] as any)

    let userIds: string[] = (finUsers || []).map((u: any) => String(u.user_id))
    if (!userIds.length) {
      const { data: admins } = await admin
        .from('escola_usuarios')
        .select('user_id,papel')
        .eq('escola_id', escolaId)
        .in('papel', ['admin','staff_admin'] as any)
        .limit(3)
      userIds = (admins || []).map((u: any) => String(u.user_id))
    }
    if (!userIds.length) return NextResponse.json({ ok: false, error: 'Nenhum destinatário encontrado (financeiro/admin).' }, { status: 400 })

    const { data: profiles } = await admin.from('profiles').select('user_id, email, nome').in('user_id', userIds)
    const recipients = ((profiles || []).map((p: any) => ({ email: String(p.email), nome: (p.nome as string | null) || undefined })) as Array<{ email: string; nome?: string }>)
      .filter((r: { email: string; nome?: string }) => !!r.email)

    if (!recipients.length) return NextResponse.json({ ok: false, error: 'Sem e-mails válidos para enviar.' }, { status: 400 })

    // Links
    const origin = new URL(req.url).origin
    const boletoUrl = `${origin}/escola/${escolaId}/financeiro/boletos`
    const dashboardUrl = `${origin}/escola/${escolaId}/financeiro/dashboards`

    // Opcional: payload com valor/vencimento (se vier no body)
    let valor: string | null = null
    let vencimento: string | null = null
    try {
      const body = await req.json().catch(() => null) as any
      valor = body?.valor ? String(body.valor) : null
      vencimento = body?.vencimento ? String(body.vencimento) : null
    } catch {
      // ignore
    }

    let sentCount = 0
    let failures: Array<{ to: string; error: string }> = []
    for (const r of recipients) {
      const { subject, html, text } = buildBillingEmail({
        escolaNome,
        destinatarioEmail: r.email,
        destinatarioNome: r.nome,
        boletoUrl,
        dashboardUrl,
        valor,
        vencimento,
      })
      const res = await sendMail({ to: r.email, subject, html, text })
      if (res.ok) sentCount++
      else failures.push({ to: r.email, error: res.error })
    }

    recordAuditServer({ escolaId, portal: 'super_admin', action: 'COBRANCA_ENVIADA', entity: 'escola', entityId: escolaId, details: { sentCount, valor, vencimento } }).catch(() => null)

    return NextResponse.json({ ok: sentCount > 0, sentCount, failures })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
