import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Legacy DELETE URL, now a non-destructive archive operation.
 * Hard deletes previously cascaded into enrolments, grades and attendance.
 * The database's turmas_audit_update trigger records this change atomically.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; turmaId: string }> },
) {
  const { id: requestedEscolaId, turmaId } = await ctx.params
  if (!UUID.test(turmaId)) {
    return NextResponse.json({ ok: false, error: 'Turma inválida' }, { status: 400 })
  }

  try {
    const supabase = await createRouteClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.id) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId)
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const authorization = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authorization.allowed) {
      return NextResponse.json({ ok: false, error: authorization.reason ?? 'Sem permissão' }, { status: 403 })
    }

    const { data: turma, error: lookupError } = await supabase
      .from('turmas')
      .select('id, status_validacao')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ ok: false, error: 'Não foi possível verificar a turma' }, { status: 503 })
    }
    if (!turma) {
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })
    }
    if (turma.status_validacao === 'arquivado') {
      return NextResponse.json({ ok: true, archived: true, already_archived: true })
    }
    const currentStatus = turma.status_validacao
    if (currentStatus !== 'ativo' && currentStatus !== 'rascunho') {
      return NextResponse.json({ ok: false, error: 'Estado da turma não permite arquivamento' }, { status: 409 })
    }

    // The UI counts only active students. Block on *any* enrolment,
    // including inactive/historical records, before hiding the turma.
    const { data: matriculas, error: enrollmentError } = await supabase
      .from('matriculas')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .limit(1)

    if (enrollmentError) {
      return NextResponse.json({ ok: false, error: 'Não foi possível verificar as matrículas' }, { status: 503 })
    }
    if (matriculas?.length) {
      return NextResponse.json({
        ok: false,
        error: 'Esta turma tem matrículas vinculadas. Transfira ou regularize os vínculos antes de arquivar.',
      }, { status: 409 })
    }

    // No privileged client and no cascading DELETEs: retain all academic data.
    // Optimistic predicate makes concurrent archive attempts idempotent at the database.
    const { data: archived, error: archiveError } = await supabase
      .from('turmas')
      .update({ status_validacao: 'arquivado' })
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .eq('status_validacao', currentStatus)
      .select('id')
      .maybeSingle()

    if (archiveError) {
      return NextResponse.json({ ok: false, error: 'Não foi possível arquivar a turma' }, { status: 503 })
    }
    if (!archived) {
      return NextResponse.json({
        ok: false,
        error: 'A turma foi alterada por outra operação. Atualize a lista e tente novamente.',
      }, { status: 409 })
    }

    return NextResponse.json({ ok: true, archived: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha inesperada ao arquivar turma' }, { status: 500 })
  }
}
