import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isTeacherBiValid, normalizeTeacherBi } from '@/lib/escola/teacher-bi'
import type { Database } from '~types/supabase'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { hasPermission, mapPapelToGlobalRole, normalizePapel } from '@/lib/permissions'
import { sanitizeEmail } from '@/lib/sanitize'
import { callAuthAdminJob } from '@/lib/auth-admin-job'
import { randomInt, randomUUID } from 'node:crypto'
import { recordAuditServer } from '@/lib/audit'
import { buildCredentialsEmail, sendMail } from '@/lib/mailer'

const TurnosSchema = z.enum(['Manhã', 'Tarde', 'Noite'])

const BodySchema = z.object({
  nome_completo: z.string().trim().min(1),
  genero: z.enum(['M', 'F']),
  data_nascimento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const d = new Date(v + 'T00:00:00Z')
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v && v <= new Date().toISOString().slice(0, 10)
  }, 'Informe uma data de nascimento válida'),
  numero_bi: z.string().nullish().refine(isTeacherBiValid, 'Informe um BI válido de 14 caracteres ou deixe em branco').transform(normalizeTeacherBi),
  email: z.string().email(),
  telefone_principal: z.string().trim().nullable().optional(),
  habilitacoes: z.enum(['Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento']),
  area_formacao: z.string().trim().nullable().optional(),
  vinculo_contratual: z.enum(['Efetivo', 'Colaborador', 'Eventual']),
  carga_horaria_maxima: z.number().int().positive().max(100),
  turnos_disponiveis: z.array(TurnosSchema).default([]),
  disciplinas_habilitadas: z.array(z.string().uuid()).max(200).default([]),
  is_diretor_turma: z.boolean().default(false),
})

const generateStrongPassword = (len = 12) => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const special = '!@#$%^&*()-_=+[]{};:,.?'
  const all = upper + lower + nums + special
  const pick = (s: string) => s[randomInt(s.length)]
  let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
  for (let i = pwd.length; i < len; i++) pwd += pick(all)
  const chars = pwd.split('')
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  const startedAt = Date.now()
  const requestId = randomUUID()
  let obsEscolaId: string | null = null
  let pendingUserId: string | null = null

  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: parse.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const body = parse.data
    const email = sanitizeEmail(body.email)
    const nome = body.nome_completo.trim()
    const roleEnum = mapPapelToGlobalRole('professor') as Database['public']['Enums']['user_role']

    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase, requesterId, escolaId)
    obsEscolaId = userEscolaId ?? null
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const emitObs = (status: 'success' | 'error', httpStatus: number, details: Record<string, unknown> = {}) => {
      const log = { event: 'academico.professor_create', request_id: requestId, escola_id: userEscolaId,
        status, http_status: httpStatus, duration_ms: Date.now() - startedAt, ...details }
      if (status === 'error') console.error(log)
      else console.info(log)
    }

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', userEscolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as { role?: string | null } | undefined)?.role)

    const profCheckRes = await supabase
      .from('profiles')
      .select('escola_id, role')
      .eq('user_id', requesterId)
      .maybeSingle()

    const profCheck = profCheckRes.data as { escola_id?: string | null; role?: string | null } | null
    const profilePapel = profCheck?.escola_id === userEscolaId ? normalizePapel(profCheck?.role) : null

    let allowed = hasPermission(papelReq, 'criar_usuario') || hasPermission(profilePapel, 'criar_usuario')
    let adminLink: { user_id: string | null }[] | null = null

    if (!allowed) {
      const { data } = await supabase
        .from('escola_administradores')
        .select('user_id')
        .eq('escola_id', userEscolaId)
        .eq('user_id', requesterId)
        .limit(1)

      adminLink = data
      allowed = Boolean(adminLink && adminLink.length > 0)
    }

    if (!allowed) {
      emitObs('error', 403, { error_code: 'FORBIDDEN' })
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const disciplinaIds = Array.from(new Set(body.disciplinas_habilitadas || []))
    if (disciplinaIds.length) {
      const { data: skills, error: skillError } = await supabase.from('disciplinas_catalogo')
        .select('id').eq('escola_id', userEscolaId).in('id', disciplinaIds)
      if (skillError) {
        emitObs('error', 503, { error_code: 'SKILLS_CHECK_FAILED' })
        return NextResponse.json({ ok: false, error: 'Não foi possível validar as disciplinas.' }, { status: 503 })
      }
      if (skills?.length !== disciplinaIds.length) {
        emitObs('error', 409, { error_code: 'INVALID_SKILLS' })
        return NextResponse.json({ ok: false, error: 'Uma disciplina selecionada não pertence à escola.' }, { status: 409 })
      }
    }

    // Check the tenant-scoped BI before any Auth side effect. The unique index remains
    // the final authority for concurrent requests.
    if (body.numero_bi) {
      const { data: duplicate, error: biError } = await supabase.from('teachers')
        .select('id').eq('escola_id', userEscolaId).eq('numero_bi', body.numero_bi).limit(1)
      if (biError) {
        emitObs('error', 503, { error_code: 'BI_CHECK_FAILED' })
        return NextResponse.json({ ok: false, code: 'BI_CHECK_FAILED', error: 'Não foi possível validar o BI. Tente novamente.' }, { status: 503 })
      }
      if (duplicate?.length) {
        emitObs('error', 409, { error_code: 'BI_ALREADY_REGISTERED' })
        return NextResponse.json({ ok: false, code: 'BI_ALREADY_REGISTERED', error: 'Já existe um professor com este BI nesta escola.' }, { status: 409 })
      }
    }

    const { data: prof, error: profileError } = await supabase
      .from('profiles').select('user_id').eq('email', email).limit(1)
    if (profileError) {
      emitObs('error', 503, { error_code: 'PROFILE_CHECK_FAILED' })
      return NextResponse.json({ ok: false, code: 'PROFILE_CHECK_FAILED', error: 'Não foi possível validar o e-mail. Tente novamente.' }, { status: 503 })
    }
    const emailConflict = () => {
      emitObs('error', 409, { error_code: 'EMAIL_ALREADY_REGISTERED' })
      return NextResponse.json({ ok: false, code: 'EMAIL_ALREADY_REGISTERED',
        error: 'Já existe uma conta com este e-mail. Verifique o cadastro existente ou solicite a recuperação.' }, { status: 409 })
    }
    if (prof?.length) return emailConflict()

    // Auth enforces global uniqueness atomically; never enumerate the first 1000 users.
    const tempPassword = generateStrongPassword(12)
    let userId: string | undefined
    try {
      const created = await callAuthAdminJob(req, 'createUser', {
        email, password: tempPassword, email_confirm: true,
        user_metadata: { nome, full_name: nome, role: roleEnum, escola_id: userEscolaId, must_change_password: true },
        app_metadata: { role: roleEnum, escola_id: userEscolaId },
      })
      userId = (created as { user?: { id?: string | null } | null } | null)?.user?.id ?? undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (/email_exists|user_already_exists|already (been )?registered|already exists/i.test(message)) return emailConflict()
      emitObs('error', 503, { error_code: 'AUTH_USER_CREATE_UNCONFIRMED' })
      return NextResponse.json({ ok: false, code: 'AUTH_USER_CREATE_UNCONFIRMED', requestId,
        error: 'Não foi possível confirmar a criação da conta. Solicite a verificação antes de repetir.' }, { status: 503 })
    }
    if (!userId) {
      emitObs('error', 503, { error_code: 'AUTH_USER_CREATE_UNCONFIRMED' })
      return NextResponse.json({ ok: false, code: 'AUTH_USER_CREATE_UNCONFIRMED', requestId,
        error: 'Não foi possível confirmar a criação da conta.' }, { status: 503 })
    }
    pendingUserId = userId

    // Only compensate a confirmed SQL transaction failure. Do not delete academic rows:
    // a transport failure can mean the transaction committed despite a lost response.
    const rollbackAuthUserCreate = async (): Promise<boolean> => {
      try {
        await callAuthAdminJob(req, 'deleteUser', { userId })
        pendingUserId = null
        return true
      } catch {
        emitObs('error', 503, { error_code: 'PROF_CREATE_ROLLBACK_FAILED', user_id: userId })
        return false
      }
    }

    const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
      'create_or_update_professor_academico',
      {
        p_escola_id: userEscolaId,
        p_user_id: userId,
        p_profile: {
          email,
          nome,
          telefone: body.telefone_principal ?? null,
          role: roleEnum,
        },
        p_teacher: {
          nome_completo: nome,
          genero: body.genero,
          data_nascimento: body.data_nascimento || null,
          numero_bi: body.numero_bi || null,
          telefone_principal: body.telefone_principal || null,
          habilitacoes: body.habilitacoes,
          area_formacao: body.area_formacao || null,
          vinculo_contratual: body.vinculo_contratual,
          carga_horaria_maxima: body.carga_horaria_maxima,
          turnos_disponiveis: body.turnos_disponiveis,
          is_diretor_turma: body.is_diretor_turma,
        },
        p_disciplina_ids: disciplinaIds,
      }
    )

    if (rpcError) {
      const dbCode = String(rpcError.code ?? '')
      const biConflict = dbCode === '23505' && /teachers_escola_numero_bi_uidx/.test(rpcError.message ?? '')
      const confirmedAbort = /^(22|23|40|42|P0)/.test(dbCode) && !/IDENTITY_ALREADY_LINKED/.test(rpcError.message ?? '')
      const rolledBack = confirmedAbort && await rollbackAuthUserCreate()
      if (!rolledBack) {
        emitObs('error', 503, { error_code: 'PROF_CREATE_RECONCILIATION_REQUIRED', db_code: dbCode, user_id: userId })
        return NextResponse.json({ ok: false, code: 'PROF_CREATE_RECONCILIATION_REQUIRED', requestId,
          error: 'Cadastro não confirmado. É necessária uma verificação antes de repetir.' }, { status: 503 })
      }
      emitObs('error', biConflict ? 409 : 400, { error_code: biConflict ? 'BI_ALREADY_REGISTERED' : 'PROF_CREATE_ACADEMICO_RPC', db_code: dbCode })
      return NextResponse.json({ ok: false, stage: 'academico',
        code: biConflict ? 'BI_ALREADY_REGISTERED' : 'PROF_CREATE_ACADEMICO_RPC',
        error: biConflict ? 'Já existe um professor com este BI nesta escola.' : 'Não foi possível concluir o cadastro académico.' }, { status: biConflict ? 409 : 400 })
    }

    const teacherId = (rpcData as { teacher_id?: string | null } | null)?.teacher_id ?? null
    if (!teacherId) {
      emitObs('error', 503, { error_code: 'PROF_CREATE_RECONCILIATION_REQUIRED', user_id: userId })
      return NextResponse.json({ ok: false, code: 'PROF_CREATE_RECONCILIATION_REQUIRED', requestId, error: 'Cadastro não confirmado. Solicite a verificação.' }, { status: 503 })
    }
    pendingUserId = null

    const origin = new URL(req.url).origin
    const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${origin}/login`).replace(/\/$/, '')
    const { data: escolaInfo } = await supabase
      .from('escolas')
      .select('nome')
      .eq('id', userEscolaId)
      .maybeSingle()
    const escolaNome = String((escolaInfo as { nome?: string | null } | null)?.nome ?? 'sua escola')

    let emailStatus: {
      attempted: boolean
      ok: boolean
      kind?: 'credentials' | 'invite'
      error?: string | null
    } = { attempted: false, ok: false }

    try {
      const mail = buildCredentialsEmail({
        nome, email, senha_temp: tempPassword, escolaNome, loginUrl,
      })
      const sent = await sendMail({
        to: email, subject: mail.subject, html: String(mail.html), text: String(mail.text),
      })
      emailStatus = { attempted: true, ok: sent.ok, kind: 'credentials', error: sent.ok ? null : 'Falha no envio de credenciais' }
    } catch {
      emailStatus = { attempted: true, ok: false, kind: 'credentials', error: 'Falha no envio de credenciais' }
      emitObs('error', 200, { error_code: 'CREDENTIALS_DELIVERY_FAILED', teacher_id: teacherId })
    }

    await recordAuditServer({
      escolaId: userEscolaId, portal: 'admin_escola', acao: 'PROFESSOR_CRIADO',
      entity: 'teachers', entityId: teacherId, details: { actor_id: requesterId, request_id: requestId },
    })

    emitObs('success', 200, { teacher_id: teacherId, user_created: true })

    return NextResponse.json({
      ok: true,
      userId,
      teacherId,
      senha_temp: tempPassword,
      emailStatus,
    })
  } catch {
    console.error({ event: 'academico.professor_create', request_id: requestId, escola_id: obsEscolaId,
      error_code: pendingUserId ? 'PROF_CREATE_RECONCILIATION_REQUIRED' : 'UNHANDLED_EXCEPTION',
      user_id: pendingUserId, duration_ms: Date.now() - startedAt })
    return NextResponse.json({ ok: false, requestId, code: pendingUserId ? 'PROF_CREATE_RECONCILIATION_REQUIRED' : 'UNHANDLED_EXCEPTION',
      error: pendingUserId ? 'Cadastro não confirmado. Solicite a verificação.' : 'Não foi possível concluir a operação.' }, { status: pendingUserId ? 503 : 500 })
  }
}
