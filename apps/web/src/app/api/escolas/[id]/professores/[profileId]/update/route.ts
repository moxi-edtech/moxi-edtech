import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { hasPermission, normalizePapel } from '@/lib/permissions'

const TurnosSchema = z.enum(['Manhã', 'Tarde', 'Noite'])

const BodySchema = z.object({
  genero: z.enum(['M', 'F']),
  data_nascimento: z.string().trim().nullable().optional(),
  numero_bi: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{14}$/, 'BI deve ter 14 caracteres alfanuméricos')
    .nullable()
    .optional(),
  telefone_principal: z.string().trim().nullable().optional(),
  habilitacoes: z.enum(['Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento']),
  area_formacao: z.string().trim().nullable().optional(),
  vinculo_contratual: z.enum(['Efetivo', 'Colaborador', 'Eventual']),
  carga_horaria_maxima: z.number().int().positive(),
  turnos_disponiveis: z.array(TurnosSchema).default([]),
  disciplinas_habilitadas: z.array(z.string().uuid()).default([]),
  is_diretor_turma: z.boolean().default(false),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; profileId: string }> }) {
  const { id: escolaId, profileId } = await context.params

  try {
    const json = await req.json()
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: parse.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const body = parse.data
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase
      .from('escola_users')
      .select('papel, role')
      .eq('user_id', requesterId)
      .eq('escola_id', escolaId)
      .limit(1)

    const papelReq = normalizePapel(vinc?.[0]?.papel ?? (vinc?.[0] as any)?.role)
    if (!hasPermission(papelReq, 'editar_usuario')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const adminUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
    if (!adminUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 500 })
    }

    const admin = createAdminClient<Database>(adminUrl, serviceKey)

    const { data: teacherRow } = await admin
      .from('teachers')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('profile_id', profileId)
      .maybeSingle()

    let teacherId = teacherRow?.id ?? null
    if (!teacherId) {
      const { data: profileRow } = await admin
        .from('profiles')
        .select('nome, email')
        .eq('user_id', profileId)
        .maybeSingle()

      const nomeCompleto = profileRow?.nome || profileRow?.email || 'Professor'
      const { data: createdTeacher, error: createErr } = await admin
        .from('teachers')
        .insert({
          escola_id: escolaId,
          profile_id: profileId,
          nome_completo: nomeCompleto,
          genero: body.genero,
          data_nascimento: body.data_nascimento || null,
          numero_bi: body.numero_bi || null,
          telefone_principal: body.telefone_principal ?? null,
          habilitacoes: body.habilitacoes,
          area_formacao: body.area_formacao ?? null,
          vinculo_contratual: body.vinculo_contratual,
          carga_horaria_maxima: body.carga_horaria_maxima,
          turnos_disponiveis: body.turnos_disponiveis,
          is_diretor_turma: body.is_diretor_turma,
        })
        .select('id')
        .maybeSingle()

      if (createErr || !createdTeacher?.id) {
        return NextResponse.json({ ok: false, error: createErr?.message || 'Professor não encontrado' }, { status: 404 })
      }
      teacherId = createdTeacher.id
    }

    const { error: updateErr } = await admin
      .from('teachers')
      .update({
        genero: body.genero,
        data_nascimento: body.data_nascimento || null,
        numero_bi: body.numero_bi || null,
        telefone_principal: body.telefone_principal ?? null,
        habilitacoes: body.habilitacoes,
        area_formacao: body.area_formacao ?? null,
        vinculo_contratual: body.vinculo_contratual,
        carga_horaria_maxima: body.carga_horaria_maxima,
        turnos_disponiveis: body.turnos_disponiveis,
        is_diretor_turma: body.is_diretor_turma,
      })
      .eq('id', teacherId)

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 })
    }

    await admin
      .from('profiles')
      .update({ telefone: body.telefone_principal ?? null })
      .eq('user_id', profileId)

    const disciplinaIds = Array.from(new Set(body.disciplinas_habilitadas || []))

    await admin
      .from('teacher_skills')
      .delete()
      .eq('teacher_id', teacherId)

    if (disciplinaIds.length > 0) {
      const { data: valid } = await admin
        .from('disciplinas_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .in('id', disciplinaIds)

      const validIds = (valid || []).map((d: any) => d.id)
      if (validIds.length > 0) {
        const rows = validIds.map((id: string) => ({
          escola_id: escolaId,
          teacher_id: teacherId,
          disciplina_id: id,
        }))
        await admin
          .from('teacher_skills')
          .upsert(rows, { onConflict: 'teacher_id,disciplina_id' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
