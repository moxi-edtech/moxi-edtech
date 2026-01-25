import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeEscolaAction } from '@/lib/escola/disciplinas'
import { recordAuditServer } from '@/lib/audit'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; turmaId: string }> }) {
  const { id: escolaId, turmaId } = await ctx.params
  try {
    // Auth + permission (must be linked to escola and have 'gerenciar_turmas')
    const supabase = await createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ['gerenciar_turmas'])
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })
    const { data: profCheck } = await supabase.from('profiles' as any).select('escola_id').eq('user_id', user.id).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })

    // Confirm turma belongs to escola
    const { data: tCheck, error: tErr } = await supabase.from('turmas').select('id').eq('id', turmaId).eq('escola_id', escolaId).maybeSingle()
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 400 })
    if (!tCheck) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    // Gather related ids
    const { data: secoes } = await supabase.from('secoes').select('id').eq('turma_id', turmaId)
    const secIds = (secoes || []).map((s: any) => s.id)
    const { data: turmaDisciplinas } = await supabase.from('turma_disciplinas').select('id').eq('turma_id', turmaId)
    const turmaDiscIds = (turmaDisciplinas || []).map((t: any) => t.id)
    const { data: mats } = await supabase.from('matriculas').select('id').eq('turma_id', turmaId)
    const matIds = (mats || []).map((m: any) => m.id)

    // Delete in safe order
    // Frequencias by matriculas
    try { if (matIds.length > 0) await supabase.from('frequencias').delete().in('matricula_id', matIds) } catch {}
    // Rotinas by turma
    try { await supabase.from('rotinas').delete().eq('turma_id', turmaId) } catch {}
    // Rotinas by seções
    try { if (secIds.length > 0) await supabase.from('rotinas').delete().in('secao_id', secIds) } catch {}
    // Rotinas by ofertas
    try { await supabase.from('rotinas').delete().eq('turma_id', turmaId) } catch {}
    // Atribuições professor por seções/ofertas
    try { if (secIds.length > 0) await supabase.from('atribuicoes_prof').delete().in('secao_id', secIds) } catch {}
    // Matriculas da turma
    try { await supabase.from('matriculas').delete().eq('turma_id', turmaId) } catch {}
    // Seções da turma
    try { if (secIds.length > 0) await supabase.from('secoes').delete().in('id', secIds) } catch {}
    // Turma disciplinas
    try { if (turmaDiscIds.length > 0) await supabase.from('turma_disciplinas').delete().in('id', turmaDiscIds) } catch {}
    try { await supabase.from('turma_disciplinas_professores').delete().eq('turma_id', turmaId) } catch {}
    // Por fim, turma
    const { error: delErr } = await supabase.from('turmas').delete().eq('id', turmaId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'admin_escola', acao: 'TURMA_EXCLUIDA_CASCADE', entity: 'turma', entityId: turmaId, details: { secIds, turmaDiscIds, matIds } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
