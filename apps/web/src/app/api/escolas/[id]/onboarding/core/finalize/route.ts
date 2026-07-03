import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
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
import { supabaseServerRole } from "@/lib/supabaseServerRole"
import { buildBaseHorarioAssignments } from "@/lib/horarios/buildBaseHorarioAssignments"
import { resolveUniversalLoginUrl } from "@/middleware"

type FinalizePendingAction = {
  title: string
  detail: string
  href: string
}

type FinalizeSummary = {
  school_name: string | null
  curriculos_publicados: number
  cursos_processados: number
  turmas_planeadas: number
  professores_auto_atribuidos: number
  cargas_auto_corrigidas: number
  horarios_publicados: number
  horarios_pendentes: number
  horarios_publicados_turmas: string[]
  horarios_pendentes_turmas: string[]
  pending_actions: FinalizePendingAction[]
  next_steps: string[]
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function isPracticalDiscipline(name: string) {
  const value = normalizeText(name)
  return (
    value.includes("laborat") ||
    value.includes("oficina") ||
    value.includes("pratica") ||
    value.includes("atelier") ||
    value.includes("ateli")
  )
}

function getTurnoIdFromTurma(turno?: string | null) {
  const rawTurno = String(turno || "").toUpperCase()
  if (rawTurno === "T") return "tarde"
  if (rawTurno === "N") return "noite"
  return "matinal"
}

function buildDefaultSlots(escolaId: string, turnoId: string) {
  const timeConfigs = turnoId === 'tarde'
    ? [
        { ordem: 1, inicio: '13:00:00', fim: '13:50:00', is_intervalo: false },
        { ordem: 2, inicio: '13:50:00', fim: '14:40:00', is_intervalo: false },
        { ordem: 3, inicio: '14:40:00', fim: '15:30:00', is_intervalo: false },
        { ordem: 4, inicio: '15:30:00', fim: '15:50:00', is_intervalo: true },
        { ordem: 5, inicio: '15:50:00', fim: '16:40:00', is_intervalo: false },
        { ordem: 6, inicio: '16:40:00', fim: '17:30:00', is_intervalo: false },
      ]
    : turnoId === 'noite'
      ? [
          { ordem: 1, inicio: '18:00:00', fim: '18:50:00', is_intervalo: false },
          { ordem: 2, inicio: '18:50:00', fim: '19:40:00', is_intervalo: false },
          { ordem: 3, inicio: '19:40:00', fim: '20:30:00', is_intervalo: false },
          { ordem: 4, inicio: '20:30:00', fim: '20:45:00', is_intervalo: true },
          { ordem: 5, inicio: '20:45:00', fim: '21:35:00', is_intervalo: false },
          { ordem: 6, inicio: '21:35:00', fim: '22:25:00', is_intervalo: false },
        ]
      : [
          { ordem: 1, inicio: '07:30:00', fim: '08:20:00', is_intervalo: false },
          { ordem: 2, inicio: '08:20:00', fim: '09:10:00', is_intervalo: false },
          { ordem: 3, inicio: '09:10:00', fim: '10:00:00', is_intervalo: false },
          { ordem: 4, inicio: '10:00:00', fim: '10:20:00', is_intervalo: true },
          { ordem: 5, inicio: '10:20:00', fim: '11:10:00', is_intervalo: false },
          { ordem: 6, inicio: '11:10:00', fim: '12:00:00', is_intervalo: false },
        ]

  const slots: Array<Record<string, unknown>> = []
  for (let dia = 1; dia <= 5; dia += 1) {
    for (const cfg of timeConfigs) {
      slots.push({
        escola_id: escolaId,
        turno_id: turnoId,
        dia_semana: dia,
        ordem: cfg.ordem,
        inicio: cfg.inicio,
        fim: cfg.fim,
        is_intervalo: cfg.is_intervalo,
      })
    }
  }
  return slots
}

async function autoPrepareOperationalBase(supabase: any, escolaId: string) {
  let professoresAutoAtribuidos = 0
  let cargasAutoCorrigidas = 0
  const horariosPublicadosTurmas: string[] = []
  const horariosPendentesTurmas: string[] = []

  const { data: teacherData } = await supabase.rpc('auto_assign_school_teachers_by_specialty', {
    p_escola_id: escolaId,
  })
  professoresAutoAtribuidos = Number(teacherData?.assigned_count || 0)

  const { data: turmas, error: turmasErr } = await supabase
    .from('turmas')
    .select('id, nome, turno')
    .eq('escola_id', escolaId)

  if (turmasErr) {
    throw new Error(`Erro ao preparar horários: ${turmasErr.message}`)
  }

  for (const turma of turmas || []) {
    const { data: cargas } = await supabase.rpc('horario_auto_configurar_cargas', {
      p_escola_id: escolaId,
      p_turma_id: turma.id,
      p_strategy: 'preset_then_default',
      p_overwrite: false,
    })
    cargasAutoCorrigidas += Array.isArray(cargas) ? cargas.length : 0

    const { data: publishedVer } = await supabase
      .from('horario_versoes')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turma.id)
      .eq('status', 'publicada')
      .limit(1)
      .maybeSingle()

    if (publishedVer?.id) {
      horariosPublicadosTurmas.push(String(turma.nome || turma.id))
      continue
    }

    const { data: versionId, error: verErr } = await supabase.rpc('ensure_horario_versao', {
      p_escola_id: escolaId,
      p_turma_id: turma.id,
      p_versao_id: undefined,
      p_status: 'draft',
    })

    if (verErr || !versionId) {
      horariosPendentesTurmas.push(String(turma.nome || turma.id))
      continue
    }

    const { data: subjects } = await supabase
      .from('turma_disciplinas')
      .select('id, curso_matriz_id, professor_id, entra_no_horario, carga_horaria_semanal, curso_matriz:curso_matriz_id(disciplina_id, carga_horaria_semanal, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(nome))')
      .eq('escola_id', escolaId)
      .eq('turma_id', turma.id)

    const activeSubjects = (subjects || []).filter((s: any) => s.entra_no_horario !== false)
    if (activeSubjects.length === 0) {
      horariosPendentesTurmas.push(String(turma.nome || turma.id))
      continue
    }

    const turnoId = getTurnoIdFromTurma(turma.turno)
    let { data: slots } = await supabase
      .from('horario_slots')
      .select('id, dia_semana, ordem, turno_id, is_intervalo')
      .eq('escola_id', escolaId)
      .eq('turno_id', turnoId)
      .order('dia_semana', { ascending: true })
      .order('ordem', { ascending: true })

    if (!slots || slots.length === 0) {
      const { data: insertedSlots, error: insertSlotsErr } = await supabase
        .from('horario_slots')
        .insert(buildDefaultSlots(escolaId, turnoId))
        .select('id, dia_semana, ordem, turno_id, is_intervalo')

      if (insertSlotsErr || !insertedSlots) {
        horariosPendentesTurmas.push(String(turma.nome || turma.id))
        continue
      }
      slots = insertedSlots
    }

    const activeSlots = (slots || []).filter((slot: any) => slot.is_intervalo === false)
    if (activeSlots.length === 0) {
      horariosPendentesTurmas.push(String(turma.nome || turma.id))
      continue
    }

    const itemsToInsert: Array<Record<string, unknown>> = buildBaseHorarioAssignments(
      activeSubjects
        .map((subject: any) => ({
          disciplinaId: subject.curso_matriz?.disciplina_id ?? null,
          professorId: subject.professor_id ?? null,
          cargaSemanal: Number(
            subject.carga_horaria_semanal ??
            subject.curso_matriz?.carga_horaria_semanal ??
            0,
          ),
          requiresDouble: Number(
            subject.carga_horaria_semanal ??
            subject.curso_matriz?.carga_horaria_semanal ??
            0,
          ) >= 3,
          isPractical: isPracticalDiscipline(String(subject.curso_matriz?.disciplina?.nome ?? "")),
        }))
        .filter((subject) => Boolean(subject.disciplinaId)),
      activeSlots.map((slot: any) => ({
        id: slot.id,
        day: slot.dia_semana,
        ordem: slot.ordem,
        isIntervalo: Boolean(slot.is_intervalo),
      })),
    ).map((assignment) => ({
      escola_id: escolaId,
      turma_id: turma.id,
      disciplina_id: assignment.disciplinaId,
      professor_id: assignment.professorId,
      slot_id: assignment.slotId,
      versao_id: String(versionId),
    }))

    if (itemsToInsert.length === 0) {
      horariosPendentesTurmas.push(String(turma.nome || turma.id))
      continue
    }

    await supabase
      .from('quadro_horarios')
      .delete()
      .eq('escola_id', escolaId)
      .eq('turma_id', turma.id)
      .eq('versao_id', String(versionId))

    const { error: insertErr } = await supabase
      .from('quadro_horarios')
      .insert(itemsToInsert)

    if (insertErr) {
      horariosPendentesTurmas.push(String(turma.nome || turma.id))
      continue
    }

    await supabase
      .from('horario_versoes')
      .update({ status: 'publicada', publicado_em: new Date().toISOString() })
      .eq('id', String(versionId))

    horariosPublicadosTurmas.push(String(turma.nome || turma.id))
  }

  return {
    professoresAutoAtribuidos,
    cargasAutoCorrigidas,
    horariosPublicadosTurmas,
    horariosPendentesTurmas,
  }
}

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
    const admin = supabaseServerRole()
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

    const PricingRuleSchema = z.object({
      cursoNome: z.string().trim().min(1),
      classeNome: z.string().trim().min(1),
      valorMatricula: z.number().min(0),
      valorMensalidade: z.number().min(0),
    })

    const MatrixRowSchema = z.object({
      nome: z.string().trim().min(1),
      manha: z.number().int().min(0).optional().default(0),
      tarde: z.number().int().min(0).optional().default(0),
      noite: z.number().int().min(0).optional().default(0),
      cursoKey: z.string().trim().min(1),
      cursoNome: z.string().trim().min(1).optional(),
    })

    const TurnosSchema = z.object({
      "Manhã": z.boolean().optional(),
      "Tarde": z.boolean().optional(),
      "Noite": z.boolean().optional(),
    })

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
      pricingRules: z.array(PricingRuleSchema).optional(),
      matrix: z.array(MatrixRowSchema).optional(),
      turnos: TurnosSchema.optional(),

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
      pricingRules,
      matrix,
      turnos,
      schoolName,
      primaryColor,
      logoUrl,
      className,
      subjects,
      teacherEmail,
      staffEmail,
    } = payload;
    const anoParaSetup = anoLetivo || new Date().getFullYear()
    const normalizedPricingRules = (pricingRules ?? [])
      .map((rule) => ({
        cursoNome: rule.cursoNome.trim(),
        classeNome: rule.classeNome.trim(),
        valorMatricula: Number(rule.valorMatricula ?? 0),
        valorMensalidade: Number(rule.valorMensalidade ?? 0),
      }))
      .filter((rule) => rule.cursoNome && rule.classeNome)
    const normalizedMatrix = (matrix ?? [])
      .map((row) => ({
        nome: row.nome.trim(),
        cursoKey: row.cursoKey.trim(),
        cursoNome: row.cursoNome?.trim() || row.cursoKey.trim(),
        manha: Number(row.manha ?? 0),
        tarde: Number(row.tarde ?? 0),
        noite: Number(row.noite ?? 0),
      }))
      .filter((row) => row.nome && row.cursoKey)
    let finalizeSummary: FinalizeSummary | null = null
    let nextPathResolved = nextPath ?? `/escola/${escolaParam}/admin/dashboard`

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
      await admin.from('escolas').update({ dados_pagamento: newDados }).eq('id', escolaIdResolved)

      // Salva Configurações Financeiras e Tabela de Preços Base
      if (diaVencimento || valorMatricula || valorMensalidade || (pricingRules?.length ?? 0) > 0) {
        // 1. Tabela de Preços Geral
        await admin.from('financeiro_tabelas').upsert({
          escola_id: escolaIdResolved,
          ano_letivo: anoParaSetup,
          curso_id: null,
          classe_id: null,
          dia_vencimento: diaVencimento || 10,
          valor_matricula: valorMatricula || 0,
          valor_mensalidade: valorMensalidade || 0,
          multa_atraso_percentual: 0,
          multa_diaria: 0,
        }, { onConflict: 'escola_id,ano_letivo,curso_id,classe_id' })

        // 2. Configurações Globais
        await admin.from('configuracoes_financeiro').upsert({
          escola_id: escolaIdResolved,
          dia_vencimento_padrao: diaVencimento || 10,
          moeda: 'AOA',
          multa_atraso_percent: 0,
          juros_diarios_percent: 0,
        }, { onConflict: 'escola_id' })
      }

      const { data: anoLetivoRow, error: anoLetivoError } = await sserver
        .from('anos_letivos')
        .select('id')
        .eq('escola_id', escolaIdResolved)
        .eq('ano', anoParaSetup)
        .maybeSingle()

      if (anoLetivoError || !anoLetivoRow?.id) {
        throw new Error('Ano letivo não encontrado para finalizar o setup académico.')
      }

      const { data: periodosRows, error: periodosError } = await sserver
        .from('periodos_letivos')
        .select('id, numero, peso')
        .eq('escola_id', escolaIdResolved)
        .eq('ano_letivo_id', anoLetivoRow.id)
        .order('numero', { ascending: true })

      if (periodosError) {
        throw new Error(`Erro ao validar períodos letivos: ${periodosError.message}`)
      }

      const periodos = periodosRows ?? []
      const totalPeso = periodos.reduce((sum, periodo: any) => sum + Number(periodo.peso ?? 0), 0)
      if (periodos.length > 0 && totalPeso !== 100) {
        const basePeso = Math.floor(100 / periodos.length)
        const pesoRemainder = 100 - (basePeso * periodos.length)

        for (const [index, periodo] of periodos.entries()) {
          const peso = basePeso + (index < pesoRemainder ? 1 : 0)
          const { error: periodoUpdateError } = await admin
            .from('periodos_letivos')
            .update({ peso })
            .eq('id', periodo.id)
            .eq('escola_id', escolaIdResolved)

          if (periodoUpdateError) {
            throw new Error(`Erro ao normalizar pesos dos períodos: ${periodoUpdateError.message}`)
          }
        }
      }

      const requestedTurmas = normalizedMatrix.reduce(
        (sum, row) => sum + row.manha + row.tarde + row.noite,
        0,
      )

      if (normalizedMatrix.length > 0 && requestedTurmas <= 0) {
        throw new Error('Defina pelo menos uma turma na matriz antes de finalizar.')
      }

      const rowsByCourse = new Map<string, typeof normalizedMatrix>()
      const resolvedCourseIds = new Map<string, string>()
      const resolvedClassIds = new Map<string, string>()
      const pricingClassKey = (cursoNome: string, classeNome: string) =>
        `${cursoNome.trim().toLowerCase()}::${classeNome.trim().toLowerCase()}`
      for (const row of normalizedMatrix) {
        const existing = rowsByCourse.get(row.cursoKey) ?? []
        existing.push(row)
        rowsByCourse.set(row.cursoKey, existing)
      }

      for (const [cursoKey, courseRows] of rowsByCourse.entries()) {
        const cursoNome = courseRows[0]?.cursoNome || cursoKey
        const { data: presetRow, error: presetError } = await admin
          .from('curriculum_presets')
          .select('course_code, name')
          .eq('id', cursoKey)
          .maybeSingle()

        if (presetError || !presetRow?.course_code) {
          throw new Error(`Preset curricular inválido para ${cursoNome}.`)
        }

        const presetCourseCode = String(presetRow.course_code).trim().toUpperCase()
        const { data: existingByKey } = await admin
          .from('cursos')
          .select('id, nome, codigo, course_code, curriculum_key')
          .eq('escola_id', escolaIdResolved)
          .eq('curriculum_key', cursoKey)
          .maybeSingle()

        const existingCourse =
          existingByKey ??
          (
            await admin
              .from('cursos')
              .select('id, nome, codigo, course_code, curriculum_key')
              .eq('escola_id', escolaIdResolved)
              .eq('nome', cursoNome)
              .maybeSingle()
          ).data ??
          null

        if (existingCourse) {
          const { data: conflictingCodeCourse } = await admin
            .from('cursos')
            .select('id, nome')
            .eq('escola_id', escolaIdResolved)
            .eq('course_code', presetCourseCode)
            .neq('id', String((existingCourse as any).id))
            .maybeSingle()

          if (conflictingCodeCourse) {
            throw new Error(
              `Já existe outro curso com o código ${presetCourseCode} (${String((conflictingCodeCourse as any).nome)}).`,
            )
          }

          const { error: existingCourseUpdateError } = await admin
            .from('cursos')
            .update({
              nome: cursoNome,
              codigo: presetCourseCode,
              course_code: presetCourseCode,
              curriculum_key: cursoKey,
              status_aprovacao: 'aprovado',
            })
            .eq('id', String((existingCourse as any).id))
            .eq('escola_id', escolaIdResolved)

          if (existingCourseUpdateError) {
            throw new Error(
              `Erro ao alinhar curso existente ${cursoNome}: ${existingCourseUpdateError.message}`,
            )
          }
        }

        const advancedConfig = {
          classes: Array.from(new Set(courseRows.map((row) => row.nome))),
          turnos: {
            manha: courseRows.some((row) => row.manha > 0) || Boolean(turnos?.["Manhã"]),
            tarde: courseRows.some((row) => row.tarde > 0) || Boolean(turnos?.["Tarde"]),
            noite: courseRows.some((row) => row.noite > 0) || Boolean(turnos?.["Noite"]),
          },
        }

        const { data: installRaw, error: installError } = await (sserver as any).rpc(
          'curriculo_install_orchestrated',
          {
            p_escola_id: escolaIdResolved,
            p_preset_key: cursoKey,
            p_ano_letivo_id: anoLetivoRow.id,
            p_auto_publish: true,
            p_generate_turmas: false,
            p_custom_data: { label: cursoNome },
            p_advanced_config: advancedConfig,
            p_idempotency_key: randomUUID(),
          },
        )

        if (installError) {
          throw new Error(`Erro ao instalar currículo de ${cursoNome}: ${installError.message}`)
        }

        const installResult = Array.isArray(installRaw) ? installRaw[0] : installRaw
        if (installResult?.ok === false && installResult?.step !== 'already_published') {
          throw new Error(
            installResult?.error ||
              installResult?.message ||
              `Falha ao publicar currículo de ${cursoNome}.`,
          )
        }

        let cursoId = installResult?.applied?.curso_id as string | undefined
        if (!cursoId) {
          const { data: cursoRow, error: cursoError } = await sserver
            .from('cursos')
            .select('id')
            .eq('escola_id', escolaIdResolved)
            .eq('curriculum_key', cursoKey)
            .maybeSingle()

          if (cursoError || !cursoRow?.id) {
            throw new Error(`Curso não resolvido após instalação do currículo ${cursoNome}.`)
          }
          cursoId = cursoRow.id
        }
        resolvedCourseIds.set(cursoNome.trim().toLowerCase(), cursoId)

        const classNames = Array.from(new Set(courseRows.map((row) => row.nome)))
        const { data: classRows, error: classError } = await sserver
          .from('classes')
          .select('id, nome')
          .eq('escola_id', escolaIdResolved)
          .eq('curso_id', cursoId)
          .in('nome', classNames)

        if (classError) {
          throw new Error(`Erro ao carregar classes de ${cursoNome}: ${classError.message}`)
        }

        const classIdByName = new Map<string, string>(
          (classRows ?? []).map((row: any) => [String(row.nome), String(row.id)]),
        )
        for (const [className, classId] of classIdByName.entries()) {
          resolvedClassIds.set(pricingClassKey(cursoNome, className), classId)
        }

        const turmasPayload = courseRows.flatMap((row) => {
          const classeId = classIdByName.get(row.nome)
          if (!classeId) {
            throw new Error(`Classe ${row.nome} não encontrada para o curso ${cursoNome}.`)
          }

          const payload: Array<{ classeId: string; nome: string; turno: 'M' | 'T' | 'N'; quantidade: number }> = []
          if (row.manha > 0) payload.push({ classeId, nome: row.nome, turno: 'M', quantidade: row.manha })
          if (row.tarde > 0) payload.push({ classeId, nome: row.nome, turno: 'T', quantidade: row.tarde })
          if (row.noite > 0) payload.push({ classeId, nome: row.nome, turno: 'N', quantidade: row.noite })
          return payload
        })

        if (turmasPayload.length === 0) {
          continue
        }

        const { data: turmasRaw, error: turmasError } = await (sserver as any).rpc(
          'gerar_turmas_from_curriculo',
          {
            p_escola_id: escolaIdResolved,
            p_curso_id: cursoId,
            p_ano_letivo: anoParaSetup,
            p_generation_params: {
              cursoId,
              anoLetivo: anoParaSetup,
              turmas: turmasPayload,
            },
            p_idempotency_key: randomUUID(),
          },
        )

        if (turmasError) {
          throw new Error(`Erro ao gerar turmas de ${cursoNome}: ${turmasError.message}`)
        }

        const turmasResult = Array.isArray(turmasRaw) ? turmasRaw[0] : turmasRaw
        if (turmasResult?.ok === false) {
          throw new Error(
            turmasResult?.message ||
              turmasResult?.error ||
              `Falha ao gerar turmas de ${cursoNome}.`,
          )
        }
      }

      if (normalizedPricingRules.length > 0) {
        if (normalizedMatrix.length === 0) {
          throw new Error('Defina a matriz académica antes de gravar preços por curso e classe.')
        }

        const unresolvedPricingRules = normalizedPricingRules.filter((rule) => {
          const cursoId = resolvedCourseIds.get(rule.cursoNome.trim().toLowerCase())
          if (!cursoId) return true
          return !resolvedClassIds.has(pricingClassKey(rule.cursoNome, rule.classeNome))
        })

        if (unresolvedPricingRules.length > 0) {
          const firstMissing = unresolvedPricingRules[0]
          throw new Error(
            `Preço específico sem estrutura académica correspondente: ${firstMissing.cursoNome} / ${firstMissing.classeNome}.`,
          )
        }

        const pricingRows = normalizedPricingRules.map((rule) => {
          const cursoId = resolvedCourseIds.get(rule.cursoNome.trim().toLowerCase())
          const classeId = resolvedClassIds.get(pricingClassKey(rule.cursoNome, rule.classeNome))
          if (!cursoId || !classeId) {
            throw new Error(
              `Preço específico sem estrutura académica correspondente: ${rule.cursoNome} / ${rule.classeNome}.`,
            )
          }

          return {
            escola_id: escolaIdResolved,
            ano_letivo: anoParaSetup,
            curso_id: cursoId,
            classe_id: classeId,
            dia_vencimento: diaVencimento || 10,
            valor_matricula: rule.valorMatricula,
            valor_mensalidade: rule.valorMensalidade,
            multa_atraso_percentual: 0,
            multa_diaria: 0,
          }
        })

        const { error: pricingError } = await admin
          .from('financeiro_tabelas')
          .upsert(pricingRows as any, { onConflict: 'escola_id,ano_letivo,curso_id,classe_id' })

        if (pricingError) {
          throw new Error(`Erro ao salvar preços por curso e classe: ${pricingError.message}`)
        }
      }

      try {
        await (sserver as any).rpc('refresh_mv_turmas_para_matricula')
      } catch {
        // best effort only
      }

      const operationalBase = await autoPrepareOperationalBase(admin as any, escolaIdResolved)
      nextPathResolved = nextPath ?? `/escola/${escolaParam}/admin/dashboard`
      const pendingActions: FinalizePendingAction[] = []

      if (operationalBase.horariosPendentesTurmas.length > 0) {
        pendingActions.push({
          title: 'Revisar horários pendentes',
          detail: `${operationalBase.horariosPendentesTurmas.length} turma(s) ainda precisam de ajuste fino no quadro.`,
          href: `/escola/${escolaParam}/admin/configuracoes/sistema`,
        })
      }

      pendingActions.push({
        title: 'Ajustar turmas e currículo',
        detail: 'Se precisar mexer em classes, disciplinas ou cargas, faça isso no painel de turmas e currículo.',
        href: `/escola/${escolaParam}/admin/configuracoes/turmas`,
      })
      pendingActions.push({
        title: 'Editar quadro de horários',
        detail: 'Use o quadro para trocar tempos, professores e salas sem refazer o onboarding.',
        href: `/escola/${escolaParam}/horarios/quadro`,
      })
      pendingActions.push({
        title: 'Revisar calendário e regras',
        detail: 'Calendário letivo, avaliação e frequência podem ser refinados depois do arranque.',
        href: `/escola/${escolaParam}/admin/configuracoes/calendario`,
      })

      finalizeSummary = {
        school_name: schoolName || null,
        curriculos_publicados: rowsByCourse.size,
        cursos_processados: rowsByCourse.size,
        turmas_planeadas: requestedTurmas,
        professores_auto_atribuidos: operationalBase.professoresAutoAtribuidos,
        cargas_auto_corrigidas: operationalBase.cargasAutoCorrigidas,
        horarios_publicados: operationalBase.horariosPublicadosTurmas.length,
        horarios_pendentes: operationalBase.horariosPendentesTurmas.length,
        horarios_publicados_turmas: operationalBase.horariosPublicadosTurmas,
        horarios_pendentes_turmas: operationalBase.horariosPendentesTurmas,
        pending_actions: pendingActions,
        next_steps: [
          'Revise o resumo final e confirme as áreas operacionais verdes.',
          'Use os atalhos do resumo para ajustar currículo, calendário ou horários quando necessário.',
          'Siga para o dashboard e acompanhe os primeiros lançamentos da escola.',
        ],
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

    if (tipo === 'academico') {
      recordAuditServer({
        escolaId: escolaIdResolved,
        portal: 'admin_escola',
        acao: 'ONBOARDING_FINALIZADO',
        entity: 'escolas',
        entityId: escolaIdResolved,
        details: {
          tipo: 'academico',
          sessionId: sessionId ?? null,
          pricingRulesCount: pricingRules?.length ?? 0,
        },
      }).catch(() => null)

      return NextResponse.json({
        ok: true,
        nextPath: nextPathResolved ?? `/escola/${escolaParam}/admin/dashboard`,
        summary: finalizeSummary,
        invites: { sent: [], updated: [], failed: [] },
      })
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
          const loginUrl = resolveUniversalLoginUrl().replace(/\/$/, "");
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
