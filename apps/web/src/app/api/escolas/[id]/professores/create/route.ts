import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, TablesInsert } from '~types/supabase'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { hasPermission, mapPapelToGlobalRole, normalizePapel } from '@/lib/permissions'
import { sanitizeEmail } from '@/lib/sanitize'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

const TurnosSchema = z.enum(['Manhã', 'Tarde', 'Noite'])

const BodySchema = z.object({
  nome_completo: z.string().trim().min(1),
  genero: z.enum(['M', 'F']),
  data_nascimento: z.string().trim().min(1),
  numero_bi: z.string().trim().regex(/^[A-Za-z0-9]{14}$/, 'BI deve ter 14 caracteres alfanuméricos'),
  email: z.string().email(),
  telefone_principal: z.string().trim().nullable().optional(),
  habilitacoes: z.enum(['Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento']),
  area_formacao: z.string().trim().nullable().optional(),
  vinculo_contratual: z.enum(['Efetivo', 'Colaborador', 'Eventual']),
  carga_horaria_maxima: z.number().int().positive(),
  turnos_disponiveis: z.array(TurnosSchema).default([]),
  disciplinas_habilitadas: z.array(z.string().uuid()).default([]),
  is_diretor_turma: z.boolean().default(false),
})

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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params

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
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as { role?: string | null } | undefined)?.role)

    const profCheckRes = await supabase
      .from('profiles')
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

    if (!allowed) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    let userId: string | undefined
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .limit(1)

    userId = prof?.[0]?.user_id as string | undefined

    if (!userId) {
      const existing = await callAuthAdminJob(req, 'findUserByEmail', { email })
      const existingUser = existing as { user?: { id?: string | null } | null } | null
      userId = existingUser?.user?.id ?? undefined
    }

    let tempPassword: string | null = null
    let userCreated = false
    if (!userId) {
      tempPassword = generateStrongPassword(12)
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
        app_metadata: { role: roleEnum, escola_id: escolaId },
      })
      const createdUser = created as { user?: { id?: string | null } | null } | null
      userId = createdUser?.user?.id ?? undefined
      userCreated = Boolean(userId)
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Falha ao criar usuário' }, { status: 400 })
    }

    const profilePayload: TablesInsert<'profiles'> = {
      user_id: userId,
      email,
      nome,
      telefone: body.telefone_principal ?? null,
      role: roleEnum,
      escola_id: escolaId,
      current_escola_id: escolaId,
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })
    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 })
    }

    const { error: escolaUsersError } = await supabase
      .from('escola_users')
      .upsert({
        escola_id: escolaId,
        user_id: userId,
        papel: 'professor',
      }, { onConflict: 'escola_id,user_id' })
    if (escolaUsersError) {
      return NextResponse.json({ ok: false, error: escolaUsersError.message }, { status: 400 })
    }

    await callAuthAdminJob(req, 'updateUserById', {
      userId,
      attributes: { app_metadata: { role: roleEnum, escola_id: escolaId } },
    })

    const { data: professorRow } = await supabase
      .from('professores')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('profile_id', userId)
      .maybeSingle()

    if (!professorRow?.id) {
      const insertPayload: TablesInsert<"professores"> = { escola_id: escolaId, profile_id: userId }
      await supabase
        .from('professores')
        .insert(insertPayload)
    }

    const { data: teacherRow, error: teacherErr } = await supabase
      .from('teachers')
      .upsert({
        escola_id: escolaId,
        profile_id: userId,
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
      }, { onConflict: 'escola_id,profile_id' })
      .select('id')
      .maybeSingle()

    if (teacherErr) {
      return NextResponse.json({ ok: false, error: teacherErr.message }, { status: 400 })
    }

    const teacherId = teacherRow?.id
    const disciplinaIds = Array.from(new Set(body.disciplinas_habilitadas || []))

    if (teacherId) {
      await supabase
        .from('teacher_skills')
        .delete()
        .eq('teacher_id', teacherId)

      if (disciplinaIds.length > 0) {
        const { data: valid } = await supabase
          .from('disciplinas_catalogo')
          .select('id')
          .eq('escola_id', escolaId)
          .in('id', disciplinaIds)

        const validIds = (valid || []).map((d: { id: string }) => d.id)
        if (validIds.length > 0) {
          const skills = validIds.map((id: string) => ({
            escola_id: escolaId,
            teacher_id: teacherId,
            disciplina_id: id,
          }))
          await supabase
            .from('teacher_skills')
            .upsert(skills, { onConflict: 'teacher_id,disciplina_id' })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      userId,
      teacherId,
      senha_temp: userCreated ? tempPassword : null,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
