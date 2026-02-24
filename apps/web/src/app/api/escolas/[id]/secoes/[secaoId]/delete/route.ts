import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { recordAuditServer } from '@/lib/audit'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; secaoId: string }> }) {
  const { id: escolaId, secaoId } = await ctx.params
  try {
    // Auth + perm
    const s = await supabaseServer()
    const { data: { user } } = await s.auth.getUser()
    if (!user?.id) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_users').select('papel').eq('user_id', user.id).eq('escola_id', escolaId).limit(1)
    const papel = vinc?.[0]?.papel as any
    if (!hasPermission(papel, 'gerenciar_turmas')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    const { data: profCheck } = await s.from('profiles' as any).select('escola_id').eq('user_id', user.id).maybeSingle()
    if (!profCheck || (profCheck as any).escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })

    // Confirm secao belongs to escola (via join turma)
    const { data: t } = await s
      .from('secoes')
      .select('id, turma_id, turmas!inner(id, escola_id)')
      .eq('id', secaoId)
      .limit(1)
    const ok = t && t[0] && ((t[0] as any).turmas?.escola_id === escolaId)
    if (!ok) return NextResponse.json({ ok: false, error: 'Seção não encontrada' }, { status: 404 })

    // Dependent deletions
    const { data: mats } = await s.from('matriculas').select('id').eq('secao_id', secaoId)
    const matIds = (mats || []).map((m: any) => m.id)
    try { if (matIds.length > 0) await s.from('frequencias').delete().in('matricula_id', matIds) } catch {}
    try { await s.from('rotinas').delete().eq('secao_id', secaoId) } catch {}
    try { await s.from('atribuicoes_prof').delete().eq('secao_id', secaoId) } catch {}
    try { await s.from('matriculas').delete().eq('secao_id', secaoId) } catch {}
    const { error: delErr } = await s.from('secoes').delete().eq('id', secaoId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'admin_escola', acao: 'SECAO_EXCLUIDA_CASCADE', entity: 'secao', entityId: secaoId, details: { matIds } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
