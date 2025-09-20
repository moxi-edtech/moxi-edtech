// apps/web/src/app/api/escolas/create/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import { z } from "zod";
import { recordAuditServer } from "@/lib/audit";
import { buildOnboardingEmail, sendMail } from "@/lib/mailer";
import type { DBWithRPC } from "@/types/supabase-augment";

const BodySchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da escola."),
  nif: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : undefined))
    .refine((v) => (v ? /^\d{9}$/.test(v) : true), {
      message: "NIF inválido. Use 9 dígitos.",
    })
    .nullable()
    .optional(),
  endereco: z.string().trim().nullable().optional(),
  admin: z.object({
      email: z
        .string()
        .email("Email do administrador inválido.")
        .transform((v) => v.toLowerCase()),
      telefone: z
        .string()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => (v ? /^9\d{8}$/.test(v) : true), {
          message: "Telefone inválido. Use o formato 9XXXXXXXX.",
        })
        .nullable()
        .optional(),
      nome: z.string().trim().nullable().optional(),
      password: z.string().trim().min(1).nullable().optional(),
    }),
  plano: z.enum(['basico','standard','premium']).default('basico').optional(),
  aluno_portal_enabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    // AuthN/AuthZ: require super_admin to create schools
    const supabase = await supabaseServerTyped<DBWithRPC>()
    const {
      data: { session },
    } = await (supabase as any).auth.getSession()
    const user = session?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    }
    const { data: prof } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const role = (prof?.[0] as any)?.role || null
    if (role !== 'super_admin') {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })
    }

    const parse = BodySchema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || "Dados inválidos"
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    const body = parse.data
    const nome = body.nome
    const nif = body.nif ?? null
    const endereco = body.endereco ?? null
    const adminEmail = body.admin?.email ?? null
    const adminTelefone = body.admin?.telefone ?? null
    const adminNome = body.admin?.nome ?? null
    const adminPassword = body.admin?.password?.trim() || null
    const plano = (body.plano || 'basico') as 'basico'|'standard'|'premium'
    const allowAlunoPortal = plano === 'standard' || plano === 'premium'
    const alunoPortalEnabled = allowAlunoPortal ? Boolean(body.aluno_portal_enabled) : false

    const { data, error } = await (supabase as any).rpc('create_escola_with_admin', {
      p_nome: nome,
      p_nif: nif,
      p_endereco: endereco,
      p_admin_email: adminEmail,
      p_admin_telefone: adminTelefone,
      p_admin_nome: adminNome,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    // data is JSON from the function: { ok, escolaId, escolaNome, mensagemAdmin }
    const result = data as { ok?: boolean; escolaId?: string; escolaNome?: string; mensagemAdmin?: string }

    // Atualiza plano e feature flags imediatamente após criação
    if (result?.escolaId) {
      const sAny = supabase as any
      await sAny.from('escolas').update({ plano, aluno_portal_enabled: alunoPortalEnabled }).eq('id', result.escolaId)
    }

    // 1) If admin email was provided, create/update user and link to escola
    let mensagemAdminAugment: string | null = null
    let actionLinkForUi: string | null = null
    let emailStatus: { attempted: boolean; via: 'custom' | 'supabase-invite' | 'supabase-magic' | null; ok: boolean; error?: string } | null = null
    if (adminEmail && result?.escolaId) {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ ...result, mensagemAdmin: (result?.mensagemAdmin || '') + ' ⚠️ Vinculação/criação do administrador não realizada: falta SUPABASE_SERVICE_ROLE_KEY.' })
      }

      const admin = createAdminClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      // Helper: strong password check
      const isStrongPassword = (pwd: string) =>
        typeof pwd === 'string' && pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)

      let mensagemAdmin = result?.mensagemAdmin || ''

      // Find existing user by email
      const lower = adminEmail.toLowerCase()
      const { data: prof } = await admin
        .from('profiles')
        .select('user_id, email, role')
        .eq('email', lower)
        .limit(1)
      let userId = prof?.[0]?.user_id as string | undefined

      // If a password was provided, create or update the user with this password
      if (adminPassword && adminPassword.length > 0) {
        if (!isStrongPassword(adminPassword)) {
          return NextResponse.json({ ok: false, error: 'Senha do administrador não atende aos requisitos: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.' }, { status: 400 })
        }
        if (userId) {
          // Update password and metadata
          const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
            password: adminPassword,
            user_metadata: { role: 'admin', must_change_password: false },
          })
          if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
          // Ensure profile role is admin
          await admin.from('profiles').update({ role: 'admin' as any, nome: adminNome ?? undefined, telefone: adminTelefone ?? undefined }).eq('user_id', userId)
          mensagemAdmin += ' ✅ Senha inicial do administrador definida.'
        } else {
          // Create user with provided password
          const { data: created, error: crtErr } = await admin.auth.admin.createUser({
            email: lower,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { role: 'admin', must_change_password: false, nome: adminNome ?? undefined },
          })
          if (crtErr || !created?.user) return NextResponse.json({ ok: false, error: crtErr?.message || 'Falha ao criar usuário admin' }, { status: 400 })
          userId = created.user.id
          // Create profile row
          await admin.from('profiles').insert([
            { user_id: userId, email: lower, nome: adminNome ?? null, telefone: adminTelefone ?? null, role: 'admin' as any },
          ] as TablesInsert<'profiles'>[])
          mensagemAdmin += ' ✅ Administrador criado com senha inicial.'
        }
      }

      // Link admin to school if we have a userId (either existing or created above)
      if (userId) {
        const { error: vincErr } = await admin
          .from('escola_usuarios')
          .upsert(
            [
              { escola_id: result.escolaId!, user_id: userId, papel: 'admin' } as TablesInsert<'escola_usuarios'>,
            ],
            { onConflict: 'escola_id,user_id' }
          )
        if (vincErr) {
          mensagemAdmin += ' ⚠️ Falha ao vincular administrador à escola.'
        } else {
          mensagemAdmin += ' 🔗 Administrador vinculado à escola.'
        }
      }

      // Build redirect URL to centralized resolver (handles onboarding/dashboard)
      const origin = new URL(req.url).origin
      const redirectTo = `${origin}/redirect`

      // Try to generate a link and send a branded email via Resend if configured
      let actionLink: string | null = null
      try {
        const { data: linkData } = await (admin as any).auth.admin.generateLink({
          type: adminPassword && adminPassword.length > 0 ? 'magiclink' : 'invite',
          email: lower,
          options: { redirectTo }
        })
        actionLink = (linkData?.properties?.action_link || linkData?.action_link || null) as string | null
      } catch {
        actionLink = null
      }

      if (actionLink) {
        const { subject, html, text } = buildOnboardingEmail({ escolaNome: result.escolaNome || 'sua escola', onboardingUrl: actionLink, adminEmail: lower, adminNome: adminNome || undefined, plano })
        const sent = await sendMail({ to: lower, subject, html, text })
        if (sent.ok) {
          mensagemAdmin += ' ✉️ E-mail enviado com instruções personalizadas para o onboarding.'
          emailStatus = { attempted: true, via: 'custom', ok: true }
        } else {
          // Keep a helpful reason in the admin message and server logs for debugging
          const reason = sent.error || 'erro desconhecido'
          console.warn('[onboarding-email] Falha no envio personalizado via SMTP/Resend:', reason)
          mensagemAdmin += ` ⚠️ Não foi possível enviar e-mail personalizado (motivo: ${reason}); tentando fallback do Supabase.`
          // Tenta fallback mesmo quando actionLink foi gerado
          try {
            if (adminPassword && adminPassword.length > 0) {
              await (admin as any).auth.signInWithOtp({ email: lower, options: { emailRedirectTo: redirectTo } })
              mensagemAdmin += ' ✉️ E-mail enviado (fallback) com link de acesso para onboarding.'
              emailStatus = { attempted: true, via: 'supabase-magic', ok: true, error: reason }
            } else {
              const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(lower, { redirectTo })
              if (inviteErr) {
                mensagemAdmin += ' ⚠️ Falha no envio de convite (fallback).'
                emailStatus = { attempted: true, via: 'supabase-invite', ok: false, error: inviteErr.message }
              } else {
                mensagemAdmin += ' ✉️ Convite enviado (fallback) para iniciar o onboarding.'
                emailStatus = { attempted: true, via: 'supabase-invite', ok: true, error: reason }
              }
            }
          } catch {
            // mantém status de falha custom se fallback também falhar silenciosamente
            emailStatus = { attempted: true, via: 'custom', ok: false, error: sent.error }
          }
        }
        actionLinkForUi = actionLink
      }

      if (!actionLink) {
        // Fallback: use Supabase built-in emails
        if (adminPassword && adminPassword.length > 0) {
          try {
            await (admin as any).auth.signInWithOtp({ email: lower, options: { emailRedirectTo: redirectTo } })
            mensagemAdmin += ' ✉️ E-mail enviado (fallback) com link de acesso para onboarding.'
            emailStatus = { attempted: true, via: 'supabase-magic', ok: true }
          } catch {
            mensagemAdmin += ' ⚠️ Falha no envio (magic link fallback).'
            emailStatus = { attempted: true, via: 'supabase-magic', ok: false }
          }
        } else {
          const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(lower, { redirectTo })
          if (inviteErr) {
            mensagemAdmin += ' ⚠️ Falha no envio de convite (fallback).'
            emailStatus = { attempted: true, via: 'supabase-invite', ok: false, error: inviteErr.message }
          } else {
            mensagemAdmin += ' ✉️ Convite enviado (fallback) para iniciar o onboarding.'
            emailStatus = { attempted: true, via: 'supabase-invite', ok: true }
          }
        }
        actionLinkForUi = redirectTo
      }

      // Collect augmented mensagemAdmin to return later
      mensagemAdminAugment = mensagemAdmin
    }

    // Auditoria: escola criada pelo Super Admin
    if (result?.escolaId) {
      recordAuditServer({
        escolaId: result.escolaId,
        portal: 'super_admin',
        action: 'ESCOLA_CRIADA',
        entity: 'escola',
        entityId: result.escolaId,
        details: { nome: result.escolaNome, plano, aluno_portal_enabled: alunoPortalEnabled }
      }).catch(() => null)
    }

    if (mensagemAdminAugment != null) {
      return NextResponse.json({ ...result, mensagemAdmin: mensagemAdminAugment, actionLink: actionLinkForUi, emailStatus })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
