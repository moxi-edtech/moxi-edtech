import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import type { DBWithRPC } from '@/types/supabase-augment'
import { buildOnboardingEmail, sendMail } from '@/lib/mailer'
import { parsePlanTier } from '@/config/plans'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

type CreateEscolaPayload = {
  ok?: boolean
  escolaId?: string
  escola_id?: string
  escolaNome?: string
  escola_nome?: string
  mensagemAdmin?: string
  [key: string]: unknown
}

type AuthUserData = {
  user?: {
    app_metadata?: { role?: string | null } | null
    user_metadata?: { role?: string | null } | null
  } | null
} | null

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Nome da escola é obrigatório'),
  nif: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  plano: z.enum(['essencial', 'profissional', 'premium']).optional().nullable(),
  admin: z
    .object({
      email: z.string().email('Email do administrador inválido').optional().nullable(),
      telefone: z.string().trim().optional().nullable(),
      nome: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export async function POST(request: Request) {
  try {
    // 1) Check caller role via session-bound client
    const supabase = await supabaseServerTyped<DBWithRPC>()
    // Early auth/role guard to provide clearer errors than raw RLS violations
    try {
      const { data: u } = await supabase.auth.getUser()
      const authData = u as AuthUserData
      const role = authData?.user?.app_metadata?.role || authData?.user?.user_metadata?.role || null
      if (role !== 'super_admin') {
        return NextResponse.json({ ok: false, error: 'Somente Super Admin pode criar escolas.' }, { status: 403 })
      }
    } catch (_) {
      // ignore and fall through; RLS will still protect
    }
    const json = await request.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    const body = parsed.data

    // Normaliza NIF para apenas dígitos (RPC também valida)
    const nif = body.nif ? body.nif.replace(/\D/g, '') : null
    const adminEmail = body.admin?.email ? body.admin.email.trim().toLowerCase() : null
    const adminTelefone = body.admin?.telefone ? body.admin.telefone.replace(/\D/g, '') : null
    const adminNome = body.admin?.nome ? body.admin.nome.trim() : null

    const { data, error } = await supabase.rpc('create_escola_with_admin', {
      p_nome: body.nome,
      p_nif: nif ?? '',
      p_endereco: body.endereco ?? '',
      p_admin_email: adminEmail ?? '',
      p_admin_telefone: adminTelefone ?? '',
      p_admin_nome: adminNome ?? '',
    })

    if (error) {
      // Mapear mensagens comuns para status mais claros
      const msg = error.message || 'Falha ao criar escola'
      const isRLS = /row-level security|RLS|permission/i.test(msg)
      const isValidation = /obrigatório|inválido|invalid|violates|duplicate/i.test(msg)
      const status = isRLS ? 403 : isValidation ? 400 : 500
      return NextResponse.json({ ok: false, error: msg }, { status })
    }

    // A função retorna um JSON com { ok, escolaId, escolaNome, mensagemAdmin }
    // Supabase tipa como Json; garantir objeto
    const payload = (typeof data === 'string' ? safeParseJSON(data) : data) as CreateEscolaPayload

    const origin = new URL(request.url).origin
    const actionLink = `${origin}/login`
    const escolaNome = payload?.escolaNome || payload?.escola_nome || body.nome
    const escolaPlano = body.plano ? parsePlanTier(body.plano) : null

    // 3) Garantir criação/vínculo do admin (sem convite; retorna senha gerada)
    let adminPassword: string | null = null
    let adminUserCreated = false
    let adminError: string | null = null

    const escolaId = payload?.escolaId || payload?.escola_id || null

    if (escolaId && body.plano) {
      await supabase
        .from('escolas')
        .update({ plano_atual: body.plano })
        .eq('id', escolaId)
    }

    if (adminEmail && escolaId) {
      try {
        const provision = await ensureAdminUser(request, supabase, {
          email: adminEmail,
          nome: adminNome,
          telefone: adminTelefone,
          escolaId,
        })
        adminPassword = provision.password
        adminUserCreated = provision.createdNew
      } catch (e: unknown) {
        adminError = e instanceof Error ? e.message : 'Falha ao provisionar admin'
      }
    }

    let emailStatus: { attempted: boolean; ok: boolean; error?: string | null } = { attempted: false, ok: false }
    if (adminEmail) {
      const { subject, html, text } = buildOnboardingEmail({
        escolaNome: escolaNome || 'sua escola',
        onboardingUrl: actionLink,
        adminEmail,
        adminNome: adminNome || undefined,
        plano: escolaPlano || undefined,
      })
      const sent = await sendMail({ to: adminEmail, subject, html: String(html), text: String(text) })
      emailStatus = { attempted: true, ok: sent.ok, error: sent.ok ? null : sent.error }
    }

    return NextResponse.json({
      ...payload,
      adminEmail,
      adminPassword,
      adminUserCreated,
      adminError,
      actionLink,
      emailStatus,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

function generateStrongPassword(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.?'
  let pwd = ''
  for (let i = 0; i < len; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pwd
}

async function ensureAdminUser(
  req: Request,
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<DBWithRPC>>>,
  params: { email: string; nome?: string | null; telefone?: string | null; escolaId: string }
) {
  const email = params.email.toLowerCase()
  const telefone = params.telefone ? params.telefone.replace(/\D/g, '') : null

  const existing = await callAuthAdminJob(req, 'findUserByEmail', { email })
  const existingUser = existing as { user?: { id?: string } } | null
  let userId: string | null = existingUser?.user?.id || null
  let password: string | null = null
  let createdNew = false

  if (!userId) {
    password = generateStrongPassword(12)
    const created = await callAuthAdminJob(req, 'createUser', {
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin', must_change_password: true, nome: params.nome ?? undefined },
      app_metadata: { role: 'admin' },
    })
    const createdUser = created as { user?: { id?: string } } | null
    userId = createdUser?.user?.id ?? null
    createdNew = true
  }

  if (!userId) throw new Error('Não foi possível obter user_id para o admin')
  const ensuredUserId: string = userId

  await supabase.from('profiles').upsert(
    {
      user_id: ensuredUserId,
      email,
      nome: params.nome ?? email,
      telefone,
      role: 'admin',
      escola_id: params.escolaId,
      current_escola_id: params.escolaId,
    },
    { onConflict: 'user_id' }
  )

  await supabase.from('escola_administradores').upsert(
    {
      escola_id: params.escolaId,
      user_id: ensuredUserId,
      cargo: 'administrador_principal',
    },
    { onConflict: 'escola_id,user_id' }
  )

  return { userId: ensuredUserId, createdNew, password }
}

function safeParseJSON(input: string) {
  try {
    return JSON.parse(input)
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor' }
  }
}
