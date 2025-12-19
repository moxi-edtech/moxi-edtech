// apps/web/src/app/api/escolas/[id]/usuarios/invite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission, mapPapelToGlobalRole } from '@/lib/permissions'
import { sanitizeEmail } from '@/lib/sanitize'
import { buildCredentialsEmail, sendMail } from '@/lib/mailer'

// ❌ REMOVIDO: generateNumeroLogin

const BodySchema = z.object({
  email: z.string().email(),
  nome: z.string().trim().min(1),
  telefone: z.string().trim().nullable().optional(),
  papel: z.enum(['admin','staff_admin','secretaria','financeiro','professor','aluno'])
    .default('secretaria'),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params

  try {
    // -------------------------------
    // 1) Parse Body
    // -------------------------------
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success)
      return NextResponse.json({ ok: false, error: parse.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })

    const body = parse.data
    const email = sanitizeEmail(body.email)
    const nome = body.nome.trim()
    const papel = body.papel
    const roleEnum = mapPapelToGlobalRole(papel) as Database["public"]["Enums"]["user_role"]

    // -------------------------------
    // 2) Permission (secretaria/admin/etc)
    // -------------------------------
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { data: vinc } = await s
      .from('escola_users')
      .select('papel')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = vinc?.[0]?.papel
    if (!hasPermission(papelReq as any, 'criar_usuario'))
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const profCheckRes = await s
      .from('profiles' as any)
      .select('escola_id')
      .eq('user_id', requesterId)
      .maybeSingle()

    const profCheck = profCheckRes.data as { escola_id?: string | null } | null

    if (!profCheck || profCheck.escola_id !== escolaId)
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })

    // -------------------------------
    // 3) Admin client
    // -------------------------------
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // -------------------------------
    // 4) Check school status
    // -------------------------------
    const { data: esc } = await admin
      .from('escolas')
      .select('status')
      .eq('id', escolaId)
      .limit(1)

    const status = esc?.[0]?.status
    if (status === 'excluida')
      return NextResponse.json({ ok: false, error: 'Escola excluída não permite convites.' }, { status: 400 })
    if (status === 'suspensa')
      return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento.' }, { status: 400 })

    // -------------------------------
    // 5) Check if user exists
    // -------------------------------
    const { data: prof } = await admin
      .from('profiles')
      .select('user_id, numero_login')
      .eq('email', email)
      .limit(1)

    let userId = prof?.[0]?.user_id as string | undefined
    const existingNumeroLogin = prof?.[0]?.numero_login ?? null

    // -------------------------------
    // 6) Invite user if new
    // -------------------------------
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

    let tempPassword: string | null = null

    if (!userId) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nome, role: roleEnum, must_change_password: true }
      })

      if (invErr)
        return NextResponse.json({ ok: false, error: invErr.message }, { status: 400 })

      userId = inv?.user?.id
      if (!userId)
        return NextResponse.json({ ok: false, error: 'Falha ao convidar usuário' }, { status: 400 })

      tempPassword = generateStrongPassword(12)
      await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        user_metadata: { must_change_password: true }
      })

      // Create profile
      await admin.from('profiles').insert({
        user_id: userId,
        email,
        nome,
        telefone: body.telefone ?? null,
        role: roleEnum,
        escola_id: escolaId,
        // numero_login: null // será criado só pela matrícula
      } as TablesInsert<'profiles'>)
    } else {
      // User exists, update profile info (BUT DO NOT GENERATE numero_login)
      await admin
        .from('profiles')
        .update({
          telefone: body.telefone ?? null,
          role: roleEnum,
          escola_id: escolaId,
        })
        .eq('user_id', userId)
    }

    // Always sync app_metadata
    await admin.auth.admin.updateUserById(userId!, {
      app_metadata: { role: roleEnum, escola_id: escolaId }
    })

    // -------------------------------
    // 7) Link to escola_users
    // -------------------------------
    try {
      await admin.from('escola_users').insert({
        escola_id: escolaId,
        user_id: userId!,
        papel,
      })
    } catch {
      await admin
        .from('escola_users')
        .update({ papel })
        .eq('user_id', userId!)
        .eq('escola_id', escolaId)
    }

    // -------------------------------
    // 8) Audit
    // -------------------------------
    recordAuditServer({
      escolaId,
      portal: 'admin_escola',
      acao: 'USUARIO_CONVIDADO',
      entity: 'usuario',
      entityId: userId!,
      details: {
        email,
        papel,
        role: roleEnum,
        numero_login: existingNumeroLogin,
      }
    }).catch(() => null)

    // -------------------------------
    // 9) Email: enviar numero_login só SE existir!
    // -------------------------------
    try {
      const { data: esc2 } = await admin
        .from('escolas')
        .select('nome')
        .eq('id', escolaId)
        .maybeSingle()

      const escolaNome = esc2?.nome ?? null
      const loginUrl = process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/login`
        : null

      const mail = buildCredentialsEmail({
        nome,
        email,
        numero_login: existingNumeroLogin ?? undefined,
        senha_temp: tempPassword ?? undefined,
        escolaNome,
        loginUrl,
      })

      await sendMail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })
    } catch {}

    return NextResponse.json({
      ok: true,
      userId,
      numero_login: existingNumeroLogin,
      senha_temp: tempPassword,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
