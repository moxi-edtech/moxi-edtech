import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { supabaseServer } from "@/lib/supabaseServer"
import type { Database, TablesInsert } from "~types/supabase"
import { mapPapelToGlobalRole } from "@/lib/permissions"
import { recordAuditServer } from "@/lib/audit"
// ❌ REMOVIDO: import { generateNumeroLogin } from "@/lib/generateNumeroLogin"
import { buildCredentialsEmail, buildOnboardingEmail, sendMail } from "@/lib/mailer"
import { z } from 'zod'
import { hasPermission } from "@/lib/permissions"

// POST /api/escolas/[id]/onboarding
// Authorizes current user against the target escola, then performs updates/inserts
// using the service role key to avoid client-side RLS violations during onboarding.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Configuração Supabase ausente (URL/Service role)." },
        { status: 500 }
      )
    }

    const EmailOpt = z.preprocess(
      (val) => {
        if (typeof val !== 'string') return undefined
        const t = val.trim().toLowerCase()
        return t.length === 0 ? undefined : t
      },
      z.string().email().optional(),
    )

    const PayloadSchema = z.object({
      // Novo: modo “finalizar onboarding acadêmico”
      tipo: z.enum(["academico"]).optional(),
      sessionId: z.string().uuid().optional(),

      // 🔹 Campos antigos (modo “onboarding geral”)
      schoolName: z.string().trim().min(1).optional(),
      primaryColor: z
        .string()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
        .optional(),
      logoUrl: z.string().url().nullable().optional(),
      className: z.string().trim().optional(),
      subjects: z.string().trim().optional(),
      teacherEmail: EmailOpt,
      staffEmail: EmailOpt,
    })

    const parse = PayloadSchema.safeParse(await req.json())
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const payload = parse.data;

    const {
      tipo,
      sessionId,
      schoolName,
      primaryColor,
      logoUrl,
      className,
      subjects,
      teacherEmail,
      staffEmail,
    } = payload;

    // 1) Get current user via RLS-safe server client
    const sserver = await supabaseServer()
    const { data: userRes } = await sserver.auth.getUser()
    const user = userRes?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    }

    // 2) Authorization: must have configurar_escola permission linked to this escola
    let authorized = false
    let nextPath: string | null = null
    try {
      const { data: vinc } = await sserver
        .from("escola_users")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .limit(1)

      if (vinc && vinc.length > 0) {
        const papel = (vinc[0] as any).papel as any
        if (hasPermission(papel, 'configurar_escola')) {
          authorized = true
          nextPath = `/escola/${escolaId}/admin/dashboard`
        }
      }
    } catch (_) {
      // table may not exist or RLS hidden; ignore here
    }

    if (!authorized) {
      // fallback: explicit admin link table
      try {
        const { data: adminLink } = await sserver
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1)

        authorized = Boolean(adminLink && adminLink.length > 0)
        if (authorized) nextPath = `/escola/${escolaId}/admin/dashboard`
      } catch (_) {
        // ignore and keep authorized as false
      }
    }

    // Fallback: if the user can read this escola via RLS, consider authorized
    if (!authorized) {
      try {
        const { data: prof } = await sserver
          .from("profiles")
          .select("user_id, role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1)

        authorized = Boolean(prof && prof.length > 0 && (prof[0] as any).role === 'admin')
        if (authorized) nextPath = `/escola/${escolaId}/admin/dashboard`
      } catch (_) {
        // keep false
      }
    }

    // Final fallback: readable escola means at least linked user; still block finishing
    if (!authorized) {
      try {
        const { data: escolaView } = await sserver
          .from("escolas")
          .select("id")
          .eq("id", escolaId)
          .limit(1)
        authorized = Boolean(escolaView && escolaView.length > 0)
      } catch (_) {
        // keep false
      }
    }

    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Sem permissão para esta escola" }, { status: 403 })
    }

    // 3) Bloqueia onboarding para escolas suspensas/excluídas
    const admin: any = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: esc } = await admin.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite finalizar onboarding.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para finalizar onboarding.' }, { status: 400 })

    // 4) Use service role to perform writes bypassing RLS

    // 3.1) Update escola basics
    const escolaUpdateBase: any = {
      ...(schoolName ? { nome: schoolName } : {}),
      ...(primaryColor ? { cor_primaria: primaryColor } : {}),
      // Atualiza logo_url somente quando houver URL válida
      ...((typeof logoUrl === 'string' && logoUrl.length > 0) ? { logo_url: logoUrl } : {}),
    }

    const updateEscolaWithFallback = async (patch: any) => {
      const { data, error } = await admin.from('escolas').update(patch).eq('id', escolaId)
      if (error && Object.prototype.hasOwnProperty.call(patch, 'needs_academic_setup')) {
        const msg = error.message || ''
        if (
          msg.includes('needs_academic_setup') ||
          msg.toLowerCase().includes('schema cache') ||
          msg.toLowerCase().includes('column')
        ) {
          const clone: any = { ...patch }
          delete clone.needs_academic_setup
          const { error: err2 } = await admin.from('escolas').update(clone).eq('id', escolaId)
          return { error: err2 }
        }
      }
      return { error }
    }

    let finalizadoOk = false
    {
      const escolaUpdate1 = {
        ...escolaUpdateBase,
        onboarding_finalizado: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_completed_by: user.id,
        needs_academic_setup: false,
      } as any
      const { error: err1 } = await updateEscolaWithFallback(escolaUpdate1)
      if (!err1) finalizadoOk = true
    }

    if (!finalizadoOk) {
      const patch = { ...escolaUpdateBase, onboarding_finalizado: true, needs_academic_setup: false } as any
      const { error: err2 } = await updateEscolaWithFallback(patch)
      if (err2) {
        return NextResponse.json(
          { ok: false, error: err2.message || 'Falha ao atualizar escola' },
          { status: 400 }
        )
      }
    }

    // 3.2) Lógica de criação de turma legada removida pois não está em conformidade com o novo modelo acadêmico.
    // A criação de turmas deve ser feita via fluxo de configuração acadêmica, que exige mais contexto (currículo, ano letivo).


    // 3.3) Create cursos if provided
    if (subjects && subjects.trim()) {
      const list = Array.from(new Set(
        subjects
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      ))

      if (list.length) {
        const { data: existing } = await (admin as any)
          .from('cursos')
          .select('nome')
          .eq('escola_id', escolaId)
          .in('nome', list)

        const existingNames = new Set<string>((existing || []).map((r: any) => r.nome as string))
        const toCreate = list.filter((nome) => !existingNames.has(nome))

        if (toCreate.length) {
          const cursoRows = toCreate.map((nome) => ({ nome, escola_id: escolaId })) as any[]
          const { error: subjectsError } = await (admin as any).from('cursos').insert(cursoRows)
          if (subjectsError) {
            return NextResponse.json({ ok: true, warning: subjectsError.message })
          }
        }
      }
    }

    // 3.4) Optional: invite initial staff (professor/secretaria) if emails provided
    const invites: Array<{ email: string; papel: 'professor' | 'secretaria'; nome?: string | null }> = []
    if (teacherEmail) invites.push({ email: teacherEmail, papel: 'professor' })
    if (staffEmail) invites.push({ email: staffEmail, papel: 'secretaria' })

    const inviteResult = { sent: [] as string[], updated: [] as string[], failed: [] as string[] }

    for (const inv of invites) {
      try {
        const roleEnum = mapPapelToGlobalRole(inv.papel)
        // Check if exists
        const { data: prof } = await admin.from('profiles').select('user_id, numero_login').eq('email', inv.email).limit(1)
        let userId = (prof?.[0] as any)?.user_id as string | undefined
        let numeroLogin: string | null = (prof?.[0] as any)?.numero_login ?? null
        let invited = false

        if (!userId) {
          const { data: inviteRes } = await (admin as any).auth.admin.inviteUserByEmail(inv.email, {
            data: { nome: inv.nome ?? inv.papel, role: roleEnum, must_change_password: true },
          })
          userId = inviteRes?.user?.id as string | undefined
          if (userId) invited = true
        }

        if (!userId) continue

        // Generate temp password for newly invited users
        let tempPassword: string | null = null
        if (invited) {
          try {
            const generateStrongPassword = (len = 12) => {
              const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
              const lower = 'abcdefghijklmnopqrstuvwxyz'
              const nums = '0123456789'
              const special = '!@#$%^&*()-_=+[]{};:,.?'
              const all = upper + lower + nums + special
              const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
              let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
              for (let i = pwd.length; i < len; i++) pwd += pick(all)
              return pwd.split('').sort(() => Math.random() - 0.5).join('')
            }
            tempPassword = generateStrongPassword(12)
            await (admin as any).auth.admin.updateUserById(userId, { password: tempPassword, user_metadata: { must_change_password: true } })
          } catch (_) {
            tempPassword = null
          }
        }

        // ❗ numero_login:
        // Agora não geramos mais aqui. Se já existia (ex: usuário-aluno previamente matriculado e promovido),
        // reaproveitamos. Caso contrário, fica null e será criado via fluxo de matrícula (quando aplicável).

        // Ensure profile (não pisa no numero_login existente se estiver null aqui)
        const profilePayload: any = {
          user_id: userId,
          email: inv.email,
          nome: inv.nome ?? inv.papel,
          role: roleEnum as any,
          escola_id: escolaId,
          current_escola_id: escolaId,
        }
        if (numeroLogin) {
          profilePayload.numero_login = numeroLogin
        }

        try {
          await admin.from('profiles').upsert(profilePayload)
        } catch {}

        // Ensure app_metadata
        try {
          await (admin as any).auth.admin.updateUserById(userId, {
            app_metadata: {
              role: roleEnum,
              escola_id: escolaId,
              numero_usuario: numeroLogin || undefined,
            },
          })
        } catch {}

        // Link papel
        try {
          await admin.from('escola_users').upsert(
            { escola_id: escolaId, user_id: userId, papel: inv.papel } as any,
            { onConflict: 'escola_id,user_id' }
          )
        } catch {}

        // Audit
        try {
          recordAuditServer({
            escolaId,
            portal: 'admin_escola',
            acao: 'USUARIO_CONVIDADO',
            entity: 'usuario',
            entityId: userId,
            details: {
              email: inv.email,
              papel: inv.papel,
              role: roleEnum,
              via: 'onboarding',
              numero_login: numeroLogin,
            },
          })
        } catch {}

        // Envia email de credenciais (inclui numero_login só se já existir)
        try {
          const { data: esc2 } = await admin.from('escolas' as any).select('nome').eq('id', escolaId).maybeSingle()
          const escolaNome = (esc2 as any)?.nome ?? null
          const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : null
          const mail = buildCredentialsEmail({
            nome: inv.nome ?? inv.papel,
            email: inv.email,
            numero_login: numeroLogin ?? undefined,
            senha_temp: tempPassword ?? undefined,
            escolaNome,
            loginUrl,
          })
          await sendMail({ to: inv.email, subject: mail.subject, html: mail.html, text: mail.text })
        } catch {}

        if (invited) inviteResult.sent.push(inv.email)
        else inviteResult.updated.push(inv.email)
      } catch (_) {
        inviteResult.failed.push(inv.email)
      }
    }

    return NextResponse.json({
      ok: true,
      nextPath: nextPath ?? `/escola/${escolaId}/admin/dashboard`,
      invites: inviteResult,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
