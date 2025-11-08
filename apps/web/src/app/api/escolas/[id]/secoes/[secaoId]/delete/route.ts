import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
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
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', user.id).eq('escola_id', escolaId).limit(1)
    const papel = vinc?.[0]?.papel as any
    if (!hasPermission(papel, 'gerenciar_turmas')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Confirm secao belongs to escola (via join turma)
    const { data: t } = await admin
      .from('secoes')
      .select('id, turma_id, turmas!inner(id, escola_id)')
      .eq('id', secaoId)
      .limit(1)
    const ok = t && t[0] && ((t[0] as any).turmas?.escola_id === escolaId)
    if (!ok) return NextResponse.json({ ok: false, error: 'Seção não encontrada' }, { status: 404 })

    // Dependent deletions
    const { data: mats } = await admin.from('matriculas').select('id').eq('secao_id', secaoId)
    const matIds = (mats || []).map((m: any) => m.id)
    try { if (matIds.length > 0) await admin.from('frequencias').delete().in('matricula_id', matIds) } catch {}
    try { await admin.from('rotinas').delete().eq('secao_id', secaoId) } catch {}
    try { await admin.from('atribuicoes_prof').delete().eq('secao_id', secaoId) } catch {}
    try { await admin.from('matriculas').delete().eq('secao_id', secaoId) } catch {}
    const { error: delErr } = await admin.from('secoes').delete().eq('id', secaoId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'admin_escola', action: 'SECAO_EXCLUIDA_CASCADE', entity: 'secao', entityId: secaoId, details: { matIds } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
