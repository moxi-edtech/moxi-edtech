import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createRouteClient } from '@/lib/supabase/route-client'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { recordAuditServer } from '@/lib/audit'
import type { Database } from '~types/supabase'

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) return null
  return createAdminClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; turmaId: string }> }) {
  const { id: escolaId, turmaId } = await ctx.params
  try {
    // Auth + permission (must be linked to escola and have 'gerenciar_turmas')
    const supabase = await createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }
    const authz = await authorizeTurmasManage(supabase as any, userEscolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })
    const { data: profCheck } = await supabase.from('profiles' as any).select('escola_id').eq('user_id', user.id).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== userEscolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const db = (admin ?? supabase) as any

    // Confirm turma belongs to escola
    const { data: tCheck, error: tErr } = await db
      .from('turmas')
      .select('id')
      .eq('id', turmaId)
      .eq('escola_id', userEscolaId)
      .maybeSingle()
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 400 })
    if (!tCheck) return NextResponse.json({ ok: true, already_deleted: true }, { status: 200 })

    // Gather related ids
    const { data: secoes } = await db.from('secoes').select('id').eq('turma_id', turmaId)
    const secIds = (secoes || []).map((s: any) => s.id)
    const { data: turmaDisciplinas } = await db.from('turma_disciplinas').select('id').eq('turma_id', turmaId)
    const turmaDiscIds = (turmaDisciplinas || []).map((t: any) => t.id)
    const { data: mats } = await db.from('matriculas').select('id').eq('turma_id', turmaId)
    const matIds = (mats || []).map((m: any) => m.id)

    // Delete in safe order
    // Frequencias by matriculas
    try { if (matIds.length > 0) await db.from('frequencias').delete().in('matricula_id', matIds) } catch {}
    // Rotinas by turma
    try { await db.from('rotinas').delete().eq('turma_id', turmaId) } catch {}
    // Rotinas by seções
    try { if (secIds.length > 0) await db.from('rotinas').delete().in('secao_id', secIds) } catch {}
    // Rotinas by ofertas
    try { await db.from('rotinas').delete().eq('turma_id', turmaId) } catch {}
    // Atribuições professor por seções/ofertas
    try { if (secIds.length > 0) await db.from('atribuicoes_prof').delete().in('secao_id', secIds) } catch {}
    // Matriculas da turma
    try { await db.from('matriculas').delete().eq('turma_id', turmaId) } catch {}
    // Seções da turma
    try { if (secIds.length > 0) await db.from('secoes').delete().in('id', secIds) } catch {}
    // Turma disciplinas
    try { if (turmaDiscIds.length > 0) await db.from('turma_disciplinas').delete().in('id', turmaDiscIds) } catch {}
    try { await db.from('turma_disciplinas_professores').delete().eq('turma_id', turmaId) } catch {}
    // Por fim, turma
    const { data: deletedTurma, error: delErr } = await db
      .from('turmas')
      .delete()
      .eq('id', turmaId)
      .eq('escola_id', userEscolaId)
      .select('id')
      .maybeSingle()
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })
    if (!deletedTurma?.id) {
      return NextResponse.json({ ok: true, already_deleted: true }, { status: 200 })
    }

    recordAuditServer({ escolaId: userEscolaId, portal: 'admin_escola', acao: 'TURMA_EXCLUIDA_CASCADE', entity: 'turma', entityId: turmaId, details: { secIds, turmaDiscIds, matIds } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
