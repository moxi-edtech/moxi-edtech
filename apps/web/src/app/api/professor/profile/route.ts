import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

const TurnosSchema = z.enum(['Manhã', 'Tarde', 'Noite'])

const UpdateSchema = z.object({
  telefone_principal: z.string().trim().nullable().optional(),
  carga_horaria_maxima: z.number().int().positive(),
  turnos_disponiveis: z.array(TurnosSchema).default([]),
  disciplinas_habilitadas: z.array(z.string().uuid()).default([]),
  area_formacao: z.string().trim().nullable().optional(),
  habilitacoes: z.enum(['Ensino Médio', 'Bacharelato', 'Licenciatura', 'Mestrado', 'Doutoramento']),
  vinculo_contratual: z.enum(['Efetivo', 'Colaborador', 'Eventual']),
})

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('id, nome_completo, genero, data_nascimento, numero_bi, telefone_principal, carga_horaria_maxima, turnos_disponiveis, habilitacoes, area_formacao, vinculo_contratual, is_diretor_turma')
      .eq('escola_id', escolaId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!teacherRow?.id) {
      return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 404 })
    }

    const { data: skillsRows } = await supabase
      .from('teacher_skills')
      .select('disciplina_id')
      .eq('escola_id', escolaId)
      .eq('teacher_id', teacherRow.id)

    const { data: disciplinasCatalogo } = await supabase
      .from('disciplinas_catalogo')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .order('nome')

    return NextResponse.json({
      ok: true,
      profile: {
        ...teacherRow,
        disciplinas_habilitadas: (skillsRows || []).map((row: { disciplina_id: string }) => row.disciplina_id),
      },
      disciplinas: disciplinasCatalogo || [],
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const parsed = UpdateSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const body = parsed.data

    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!teacherRow?.id) {
      return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 404 })
    }

    const { error: updateErr } = await supabase
      .from('teachers')
      .update({
        telefone_principal: body.telefone_principal ?? null,
        carga_horaria_maxima: body.carga_horaria_maxima,
        turnos_disponiveis: body.turnos_disponiveis,
        area_formacao: body.area_formacao ?? null,
        habilitacoes: body.habilitacoes,
        vinculo_contratual: body.vinculo_contratual,
      })
      .eq('id', teacherRow.id)

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 })
    }

    await supabase
      .from('profiles')
      .update({ telefone: body.telefone_principal ?? null })
      .eq('user_id', user.id)

    const disciplinaIds = Array.from(new Set(body.disciplinas_habilitadas || []))
    await supabase
      .from('teacher_skills')
      .delete()
      .eq('teacher_id', teacherRow.id)

    if (disciplinaIds.length > 0) {
      const { data: valid } = await supabase
        .from('disciplinas_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .in('id', disciplinaIds)

      const validIds = (valid || []).map((d: { id: string }) => d.id)
      if (validIds.length > 0) {
        const rows = validIds.map((id: string) => ({
          escola_id: escolaId,
          teacher_id: teacherRow.id,
          disciplina_id: id,
        }))
        await supabase
          .from('teacher_skills')
          .upsert(rows, { onConflict: 'teacher_id,disciplina_id' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
