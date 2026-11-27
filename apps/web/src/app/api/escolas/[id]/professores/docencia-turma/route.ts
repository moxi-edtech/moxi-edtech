import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTeacherManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

const UUID = z.string().uuid()
const Body = z.discriminatedUnion('regime', [
  z.object({ turma_id: UUID, regime: z.literal('pluridocencia') }).strict(),
  z.object({ turma_id: UUID, regime: z.literal('trocar_disciplinas'), professor_id: UUID,
    scope: z.enum(['all','some']), expected: z.array(z.object({ matriz_id: UUID, professor_id: UUID.nullable() }).strict()).min(1).max(100),
  }).strict(),
  z.object({ turma_id: UUID, regime: z.literal('trocar_titular'), professor_anterior_id: UUID, professor_novo_id: UUID }).strict(),
  z.object({ turma_id: UUID, regime: z.literal('monodocencia'), professor_id: UUID }).strict(),
  z.object({ turma_id: UUID, regime: z.literal('misto'), professor_id: UUID, matriz_ids: z.array(UUID).min(1).max(100) }).strict(),
])

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: escolaId } = await ctx.params
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!UUID.safeParse(escolaId).success || !parsed.success)
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
    const supabase = await supabaseServerTyped<any>()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
    const resolved = await resolveEscolaIdForUser(supabase as any, auth.user.id, escolaId)
    const permission = await authorizeTeacherManage(supabase as any, escolaId, auth.user.id)
    if (resolved !== escolaId || !permission.allowed)
      return NextResponse.json({ ok: false, error: 'Sem permissão.' }, { status: 403 })
    const body = parsed.data
    if (body.regime === 'trocar_disciplinas') {
      const { data, error } = await supabase.rpc('replace_teacher_subjects_atomic', {
        p_escola_id: escolaId, p_turma_id: body.turma_id, p_professor_novo_id: body.professor_id,
        p_scope: body.scope, p_expected: body.expected,
      })
      if (error) {
        const msg = error.message || ''
        const message = /WORKLOAD_EXCEEDED|CARGA_EXCEEDED/.test(msg)
          ? 'O limite lectivo do professor seria ultrapassado. Nenhuma disciplina foi alterada.'
          : /PREVIOUS_MISMATCH|ALREADY_ASSIGNED|CONFLICTING_LINKS|OFFERING_NOT_PUBLISHED/.test(msg)
            ? 'Os vínculos da turma mudaram. Actualize e reveja a substituição.'
            : /DURATION_UNCONFIGURED/.test(msg) ? 'Não foi possível confirmar a carga lectiva. Reveja o horário da turma.'
            : 'Não foi possível substituir o professor. Nenhuma disciplina foi alterada.'
        return NextResponse.json({ ok: false, error: message }, { status: /FORBIDDEN/.test(msg) ? 403 : 409 })
      }
      return NextResponse.json({ ok: true, processadas: data })
    }
    if (body.regime === 'trocar_titular') {
      const { data, error } = await supabase.rpc('replace_teacher_titular_atomic', {
        p_escola_id: escolaId, p_turma_id: body.turma_id,
        p_professor_anterior_id: body.professor_anterior_id, p_professor_novo_id: body.professor_novo_id,
      })
      if (error) {
        const message = /WORKLOAD_EXCEEDED|CARGA_EXCEEDED/.test(error.message)
          ? 'A carga lectiva do novo professor não permite esta atribuição. Nenhuma disciplina foi alterada.'
          : /TITULAR_CONFLICT|PREVIOUS_MISMATCH/.test(error.message)
            ? 'A turma foi actualizada. Reabra os dados e confirme o professor titular.'
            : 'Não foi possível trocar o professor titular. Nenhuma atribuição foi alterada.'
        return NextResponse.json({ ok: false, error: message }, { status: 409 })
      }
      return NextResponse.json({ ok: true, processadas: data })
    }
    const { data, error } = await supabase.rpc('assign_teacher_regime_atomic', {
      p_escola_id: escolaId, p_turma_id: body.turma_id, p_regime: body.regime,
      p_professor_id: body.regime === 'pluridocencia' ? null : body.professor_id,
      p_matriz_ids: body.regime === 'misto' ? body.matriz_ids : null,
    })
    if (error) {
      const message = /CARGA_EXCEEDED/.test(error.message) ? 'A carga lectiva projectada ultrapassa o limite. Nenhuma atribuição foi alterada.'
        : /DURATION_UNCONFIGURED/.test(error.message) ? 'Não foi possível confirmar a disponibilidade do professor. Peça à administração para rever o horário da turma.'
        : /TITULAR_CONFLICT/.test(error.message) ? 'Esta turma já tem um professor titular. Nenhuma atribuição foi alterada.'
        : /ALREADY_ASSIGNED/.test(error.message) ? 'Existem disciplinas atribuídas a outro docente. Nenhuma atribuição foi alterada.'
        : 'Não foi possível configurar a docência da turma.'
      return NextResponse.json({ ok: false, error: message }, { status: 409 })
    }
    return NextResponse.json({ ok: true, processadas: data })
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha ao configurar a docência.' }, { status: 500 })
  }
}
