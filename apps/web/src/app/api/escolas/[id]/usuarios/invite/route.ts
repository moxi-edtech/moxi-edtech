// apps/web/src/app/api/escolas/[id]/usuarios/invite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, TablesInsert } from '~types/supabase'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createRouteClient } from '@/lib/supabase/route-client'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission, mapPapelToGlobalRole, normalizePapel } from '@/lib/permissions'
import { sanitizeEmail } from '@/lib/sanitize'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

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
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId)
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as any)?.role)

    const profCheckRes = await supabase
      .from('profiles' as any)
      .select('escola_id, role')
      .eq('user_id', requesterId)
      .maybeSingle()

    const profCheck = profCheckRes.data as { escola_id?: string | null; role?: string | null } | null
    const profilePapel = profCheck?.escola_id === escolaId ? normalizePapel(profCheck?.role) : null

    let allowed = hasPermission(papelReq, 'criar_usuario') || hasPermission(profilePapel, 'criar_usuario')
    let adminLink: { user_id: string | null }[] | null = null

    if (!allowed) {
      const { data } = await supabase
        .from('escola_administradores')
        .select('user_id')
        .eq('escola_id', escolaId)
        .eq('user_id', requesterId)
        .limit(1)

      adminLink = data
      allowed = Boolean(adminLink && adminLink.length > 0)
    }

    if (!allowed)
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const hasVinculo = Boolean(vinc && vinc.length > 0) || Boolean(adminLink && adminLink.length > 0) || profCheck?.escola_id === escolaId
    if (!hasVinculo)
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })

    // -------------------------------
    // 3) Admin client
    // -------------------------------
    // -------------------------------
    // 4) Check school status
    // -------------------------------
    const { data: esc } = await supabase
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
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id, numero_login')
      .eq('email', email)
      .limit(1)

    let userId = prof?.[0]?.user_id as string | undefined
    let existingNumeroLogin = prof?.[0]?.numero_login ?? null

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
    let userCreated = false
    const adminUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
    const admin = adminUrl && serviceKey ? createAdminClient<Database>(adminUrl, serviceKey) : null

    const resolveExistingUserId = async () => {
      const normalizedEmail = email.toLowerCase()
      if (admin) {
        const { data: authRow, error: authErr } = await (admin as any)
          .from('auth.users')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (!authErr && authRow?.id) return authRow.id

        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (error) return null
        const found = (data?.users || []).find((u) => u.email?.toLowerCase() === normalizedEmail)
        return found?.id ?? null
      }
      try {
        const list = await callAuthAdminJob(req, 'listUsers', { page: 1, perPage: 1000 })
        const found = (list?.users || []).find((u: any) => u.email?.toLowerCase() === normalizedEmail)
        return found?.id ?? null
      } catch {
        return null
      }
    }

    if (!userId && admin) {
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('user_id, numero_login')
        .eq('email', email)
        .limit(1)

      if (adminProfile?.[0]?.user_id) {
        userId = adminProfile[0].user_id as string
        existingNumeroLogin = adminProfile[0].numero_login ?? existingNumeroLogin
      }
    }

    if (!userId) {
      userId = await resolveExistingUserId()
      userCreated = false
    }

    if (!userId) {
      tempPassword = generateStrongPassword(12)

      let createError: string | null = null
      if (admin) {
        const created = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            nome,
            full_name: nome,
            role: roleEnum,
            escola_id: escolaId,
            must_change_password: true,
          },
        })
        if (created.error) {
          createError = created.error.message
        } else {
          userId = created.data?.user?.id
          userCreated = Boolean(userId)
        }
      } else {
        try {
          const created = await callAuthAdminJob(req, 'createUser', {
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              nome,
              full_name: nome,
              role: roleEnum,
              escola_id: escolaId,
              must_change_password: true,
            },
          })
          userId = (created as any)?.user?.id
          userCreated = Boolean(userId)
        } catch (error) {
          createError = error instanceof Error ? error.message : 'Auth admin job failed'
        }
      }

      if (!userId)
        return NextResponse.json({
          ok: false,
          error: createError || 'Falha ao criar usuário',
          hint: 'Verifique se o e-mail já existe no Auth ou se há regras de senha/rolagem bloqueando a criação.',
        }, { status: 400 })

      const profilePayload: TablesInsert<'profiles'> = {
        user_id: userId,
        email,
        nome,
        telefone: body.telefone ?? null,
        role: roleEnum,
        escola_id: escolaId,
        current_escola_id: escolaId,
      }

      const profileClient = admin ?? supabase
      const { error: profileError } = await profileClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'user_id' })

      if (profileError) {
        return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 })
      }
    }

    // Always sync app_metadata
    if (admin) {
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId!, {
        app_metadata: { role: roleEnum, escola_id: escolaId },
      })
      if (updateErr) {
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 })
      }
    } else {
      await callAuthAdminJob(req, 'updateUserById', {
        userId: userId!,
        attributes: { app_metadata: { role: roleEnum, escola_id: escolaId } },
      })
    }

    // -------------------------------
    // 7) Link to escola_users
    // -------------------------------
    const escolaUsersClient = admin ?? supabase
    const { error: escolaUsersError } = await escolaUsersClient
      .from('escola_users')
      .upsert({
        escola_id: escolaId,
        user_id: userId!,
        papel,
      }, { onConflict: 'escola_id,user_id' })

    if (escolaUsersError) {
      return NextResponse.json({ ok: false, error: escolaUsersError.message }, { status: 400 })
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
