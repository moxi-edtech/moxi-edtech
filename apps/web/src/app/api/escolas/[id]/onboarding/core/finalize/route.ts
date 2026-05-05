import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"
import type { Database, TablesInsert } from "~types/supabase"
import { mapPapelToGlobalRole } from "@/lib/permissions"
import { recordAuditServer } from "@/lib/audit"
// ❌ REMOVIDO: import { generateNumeroLogin } from "@/lib/generateNumeroLogin"
import { buildCredentialsEmail, buildOnboardingEmail, sendMail } from "@/lib/mailer"
import { z } from 'zod'
import { hasPermission } from "@/lib/permissions"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { invalidateEscolaSlugCache } from "@/lib/tenant/resolveEscolaParam"

// POST /api/escolas/[id]/onboarding
// Authorizes current user against the target escola, then performs updates/inserts
// using the service role key to avoid client-side RLS violations during onboarding.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    // 1) Get current user via RLS-safe server client
    const sserver = await supabaseServer()
    const { data: userRes } = await sserver.auth.getUser()
    const user = userRes?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(sserver as any, user.id, escolaId)
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 })
    }
    const escolaIdResolved = resolvedEscolaId
    const { data: escolaInfo } = await sserver
      .from('escolas')
      .select('slug')
      .eq('id', escolaIdResolved)
      .maybeSingle()
    const oldSlug = escolaInfo?.slug ?? null
    const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaIdResolved

    // 2) Authorization: must have configurar_escola permission linked to this escola
    let authorized = false
    let nextPath: string | null = null
    try {
      const { data: vinc } = await sserver
        .from("escola_users")
        .select("papel")
        .eq("escola_id", escolaIdResolved)
        .eq("user_id", user.id)
        .limit(1)

      if (vinc && vinc.length > 0) {
        const papel = vinc[0].papel
        if (hasPermission(papel as any, 'configurar_escola')) {
          authorized = true
          nextPath = `/escola/${escolaParam}/admin/dashboard`
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
          .eq("escola_id", escolaIdResolved)
          .eq("user_id", user.id)
          .limit(1)

        authorized = Boolean(adminLink && adminLink.length > 0)
        if (authorized) nextPath = `/escola/${escolaParam}/admin/dashboard`
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
          .eq("escola_id", escolaIdResolved)
          .limit(1)

        authorized = Boolean(prof && prof.length > 0 && prof[0].role === 'admin')
        if (authorized) nextPath = `/escola/${escolaParam}/admin/dashboard`
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
          .eq("id", escolaIdResolved)
          .limit(1)
        authorized = Boolean(escolaView && escolaView.length > 0)
      } catch (_) {
        // keep false
      }
    }

    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Sem permissão para esta escola" }, { status: 403 })
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

      // Novos campos financeiros (Onboarding Acadêmico)
      iban: z.string().optional(),
      valorMatricula: z.number().optional(),
      valorMensalidade: z.number().optional(),
      diaVencimento: z.number().int().min(1).max(31).optional(),
      anoLetivo: z.number().optional(),

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
      iban,
      valorMatricula,
      valorMensalidade,
      diaVencimento,
      anoLetivo,
      schoolName,
      primaryColor,
      logoUrl,
      className,
      subjects,
      teacherEmail,
      staffEmail,
    } = payload;

    // 3) Bloqueia onboarding para escolas suspensas/excluídas
    const { data: esc } = await sserver.from('escolas').select('status, dados_pagamento').eq('id', escolaIdResolved).limit(1)
    const status = esc?.[0]?.status
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite finalizar onboarding.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para finalizar onboarding.' }, { status: 400 })

    // --- LOGICA FINANCEIRA (Novo) ---
    if (tipo === 'academico') {
      const currentDados = (esc?.[0]?.dados_pagamento as Record<string, any>) || {}
      const newDados = { ...currentDados, iban: iban || currentDados.iban }
      
      // Salva IBAN na escola
      await sserver.from('escolas').update({ dados_pagamento: newDados }).eq('id', escolaIdResolved)

      // Salva Configurações Financeiras e Tabela de Preços Base
      if (diaVencimento || valorMatricula || valorMensalidade) {
        const anoParaTabela = anoLetivo || new Date().getFullYear()

        // 1. Tabela de Preços Geral
        await sserver.from('financeiro_tabelas').upsert({
          escola_id: escolaIdResolved,
          ano_letivo: anoParaTabela,
          curso_id: null,
          classe_id: null,
          dia_vencimento: diaVencimento || 10,
          valor_matricula: valorMatricula || 0,
          valor_mensalidade: valorMensalidade || 0,
          multa_atraso_percentual: 0,
          multa_diaria: 0,
        }, { onConflict: 'escola_id,ano_letivo,curso_id,classe_id' })

        // 2. Configurações Globais
        await sserver.from('configuracoes_financeiro').upsert({
          escola_id: escolaIdResolved,
          dia_vencimento_padrao: diaVencimento || 10,
          moeda: 'AOA',
          multa_atraso_percent: 0,
          juros_diarios_percent: 0,
        }, { onConflict: 'escola_id' })
      }
    }

    // 4) Atualizações via RLS (user context)

    // 3.1) Update escola basics
    const escolaUpdate = {
      ...(schoolName ? { nome: schoolName } : {}),
      ...(primaryColor ? { cor_primaria: primaryColor } : {}),
      ...((typeof logoUrl === 'string' && logoUrl.length > 0) ? { logo_url: logoUrl } : {}),
      onboarding_finalizado: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_completed_by: user.id,
      needs_academic_setup: false,
    }

    const { error: errUpdate } = await sserver.from('escolas').update(escolaUpdate).eq('id', escolaIdResolved)
    if (errUpdate) {
      return NextResponse.json(
        { ok: false, error: errUpdate.message || 'Falha ao atualizar escola' },
        { status: 400 }
      )
    }

    const { data: escolaAfter } = await sserver
      .from('escolas')
      .select('slug')
      .eq('id', escolaIdResolved)
      .maybeSingle()
    const newSlug = escolaAfter?.slug ?? null

    invalidateEscolaSlugCache(oldSlug)
    invalidateEscolaSlugCache(newSlug)

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
        const { data: existing } = await sserver
          .from('cursos')
          .select('nome')
          .eq('escola_id', escolaIdResolved)
          .in('nome', list)

        const existingNames = new Set<string>((existing || []).map((r) => r.nome))
        const toCreate = list.filter((nome) => !existingNames.has(nome))

        if (toCreate.length) {
          const cursoRows = toCreate.map((nome) => ({
            nome,
            escola_id: escolaIdResolved,
            codigo: nome.substring(0, 10).toUpperCase() // Cursos require codigo
          }))
          const { error: subjectsError } = await sserver.from('cursos').insert(cursoRows)
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
        const papel = inv.papel === 'professor' ? 'professor' : 'secretaria'
        const roleEnum = mapPapelToGlobalRole(papel)
        // Check if exists
        const { data: prof } = await sserver.from('profiles').select('user_id').eq('email', inv.email).limit(1)
        const userId = prof?.[0]?.user_id

        if (!userId) {
          inviteResult.failed.push(inv.email)
          continue
        }

        const invited = false

        // Generate temp password for newly invited users
        let tempPassword: string | null = null
        if (invited) {
          tempPassword = null
        }

        // Ensure profile
        const profilePayload: any = {
          user_id: userId,
          email: inv.email,
          nome: inv.nome ?? papel,
          role: roleEnum,
          escola_id: escolaIdResolved,
          current_escola_id: escolaIdResolved,
        }

        try {
          await sserver.from('profiles').upsert(profilePayload)
        } catch {}

        // Link papel
        try {
          await sserver.from('escola_users').upsert(
            { escola_id: escolaIdResolved, user_id: userId, papel: papel, tenant_type: 'k12' },
            { onConflict: 'escola_id,user_id' }
          )
        } catch {}

        // Audit
        try {
          recordAuditServer({
            escolaId: escolaIdResolved,
            portal: 'admin_escola',
            acao: 'USUARIO_CONVIDADO',
            entity: 'usuario',
            entityId: userId,
            details: {
              email: inv.email,
              papel: papel,
              role: roleEnum,
              via: 'onboarding',
            },
          })
        } catch {}

        // Envia email de credenciais
        try {
          const { data: esc2 } = await sserver.from('escolas').select('nome').eq('id', escolaIdResolved).maybeSingle()
          const escolaNome = esc2?.nome ?? null
          const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : null
          const mail = buildCredentialsEmail({
            nome: inv.nome ?? papel,
            email: inv.email,
            numero_processo_login: undefined,
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

    recordAuditServer({
      escolaId: escolaIdResolved,
      portal: 'admin_escola',
      acao: 'ONBOARDING_FINALIZADO',
      entity: 'escolas',
      entityId: escolaIdResolved,
      details: {
        tipo: tipo ?? 'geral',
        sessionId: sessionId ?? null,
        convites: inviteResult,
      },
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      nextPath: nextPath ?? `/escola/${escolaParam}/admin/dashboard`,
      invites: inviteResult,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
