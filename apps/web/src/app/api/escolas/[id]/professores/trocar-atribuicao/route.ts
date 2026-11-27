import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTeacherManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { dispatchProfessorNotificacao } from '@/lib/notificacoes/dispatchProfessorNotificacao'

export const dynamic = 'force-dynamic'

const UUID = z.string().uuid()
const Body = z.object({
  turma_id: UUID,
  curso_matriz_id: UUID,
  professor_anterior_id: UUID, // public.professores.id — mandatory CAS value
  professor_novo_user_id: UUID, // profiles.user_id
}).strict()

const errorMessages: Array<[RegExp, number, string]> = [
  [/TEACHER_REPLACE_FORBIDDEN/, 403, 'Sem permissão para trocar professores nesta escola.'],
  [/TEACHER_REPLACE_PREVIOUS_MISMATCH|TEACHER_REPLACE_CONFLICTING_LINKS/, 409,
    'O professor atual mudou ou os vínculos estão inconsistentes. Atualize a turma antes de tentar novamente.'],
  [/TEACHER_REPLACE_OFFERING_NOT_PUBLISHED|TEACHER_REPLACE_YEAR_NOT_ACTIVE/, 409,
    'Esta disciplina não está publicada para a turma no ano letivo ativo.'],
  [/TEACHER_REGIME_TITULAR_LAST_SUBJECT/, 409,
    'Esta é a última disciplina do professor titular. Troque o professor da turma antes de continuar.'],
  [/TEACHER_LOAD_DURATION_UNCONFIGURED/, 409,
    'Não foi possível confirmar a disponibilidade do professor. Peça à administração para rever o horário.'],
  [/TEACHER_REPLACE_WORKLOAD_EXCEEDED|ASSIGN_PROF_CARGA_EXCEEDED/, 409,
    'A carga horária máxima do novo professor seria ultrapassada.'],
  [/TEACHER_REPLACE_SCHEDULE_CONFLICT|Conflito global de professor para slot publicado/, 409,
    'O novo professor já leciona noutra turma neste horário.'],
  [/TEACHER_REPLACE_NEW_TEACHER_NOT_FOUND/, 404,
    'O novo professor não pertence à escola ou não tem cadastro completo.'],
  [/TEACHER_REPLACE_INVALID_INPUT/, 400, 'Selecione dois professores diferentes.'],
]

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  if (!UUID.safeParse(escolaId).success) {
    return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 400 })
  }
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
  }

  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const resolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (resolved !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem acesso a esta escola' }, { status: 403 })
    }
    const permission = await authorizeTeacherManage(supabase as any, escolaId, user.id)
    if (!permission.allowed) {
      return NextResponse.json({ ok: false, error: 'Sem permissão para gerir professores' }, { status: 403 })
    }

    const { data: newTeacher, error: teacherError } = await supabase.from('professores')
      .select('id,profile_id')
      .eq('escola_id', escolaId)
      .eq('profile_id', parsed.data.professor_novo_user_id)
      .maybeSingle()
    if (teacherError) throw teacherError
    if (!newTeacher?.id) {
      return NextResponse.json({ ok: false, error: 'Professor não encontrado nesta escola' }, { status: 404 })
    }
    if (newTeacher.id === parsed.data.professor_anterior_id) {
      return NextResponse.json({ ok: false, error: 'O professor escolhido já está atribuído.' }, { status: 400 })
    }

    // Single RPC: guarded by the same advisory lock as individual and batch
    // assignments. CAS, workload, slots, timetable, and audit commit together.
    let { data, error } = await supabase.rpc('trocar_professor_turma_disciplina_atomic', {
      p_escola_id: escolaId,
      p_turma_id: parsed.data.turma_id,
      p_curso_matriz_id: parsed.data.curso_matriz_id,
      p_professor_anterior_id: parsed.data.professor_anterior_id,
      p_professor_novo_id: newTeacher.id,
    })
    // An explicitly confirmed last-subject swap must not force staff to ask
    // support to change the titular. The first RPC failed without writes;
    // the atomic multi-subject engine verifies the same expected owner again.
    if (error?.message?.includes('TEACHER_REGIME_TITULAR_LAST_SUBJECT')) {
      const replacement = await supabase.rpc('replace_teacher_subjects_atomic', {
        p_escola_id: escolaId, p_turma_id: parsed.data.turma_id,
        p_professor_novo_id: newTeacher.id, p_scope: 'some',
        p_expected: [{ matriz_id: parsed.data.curso_matriz_id, professor_id: parsed.data.professor_anterior_id }],
      })
      error = replacement.error
      data = null
    }
    if (error) {
      const known = errorMessages.find(([pattern]) => pattern.test(error.message || ''))
      return NextResponse.json({
        ok: false,
        error: known?.[2] ?? 'Não foi possível trocar o professor. Verifique a turma e tente novamente.',
      }, { status: known?.[1] ?? 409 })
    }

    const details = Array.isArray(data) ? data[0] : data
    await dispatchProfessorNotificacao({
      escolaId,
      key: 'TURMA_ATRIBUIDA',
      params: { actionUrl: `/professor/turmas/${parsed.data.turma_id}` },
      recipientIds: [parsed.data.professor_novo_user_id],
      actorId: user.id,
      actorRole: 'secretaria',
      agrupamentoTTLHoras: 12,
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      professor_novo_user_id: details?.professor_novo_profile_id ?? newTeacher.profile_id,
      carga_atual: details?.carga_atual ?? null,
      carga_maxima: details?.carga_maxima ?? null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha ao trocar professor.' }, { status: 500 })
  }
}
