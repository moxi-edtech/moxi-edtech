import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'
import { recordAuditServer } from '@/lib/audit'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; turmaId: string }> }) {
  const { id: escolaId, turmaId } = await ctx.params
  try {
    // Auth + permission (must be linked to escola and have 'gerenciar_turmas')
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

    // Confirm turma belongs to escola
    const { data: tCheck, error: tErr } = await admin.from('turmas').select('id').eq('id', turmaId).eq('escola_id', escolaId).maybeSingle()
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 400 })
    if (!tCheck) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    // Gather related ids
    const { data: secoes } = await admin.from('secoes').select('id').eq('turma_id', turmaId)
    const secIds = (secoes || []).map((s: any) => s.id)
    const { data: ofertas } = await admin.from('cursos_oferta').select('id').eq('turma_id', turmaId)
    const ofertaIds = (ofertas || []).map((o: any) => o.id)
    const { data: mats } = await admin.from('matriculas').select('id').eq('turma_id', turmaId)
    const matIds = (mats || []).map((m: any) => m.id)

    // Delete in safe order
    // Frequencias by matriculas
    try { if (matIds.length > 0) await admin.from('frequencias').delete().in('matricula_id', matIds) } catch {}
    // Rotinas by turma
    try { await admin.from('rotinas').delete().eq('turma_id', turmaId) } catch {}
    // Rotinas by seções
    try { if (secIds.length > 0) await admin.from('rotinas').delete().in('secao_id', secIds) } catch {}
    // Rotinas by ofertas
    try { if (ofertaIds.length > 0) await admin.from('rotinas').delete().in('curso_oferta_id', ofertaIds) } catch {}
    // Atribuições professor por seções/ofertas
    try { if (secIds.length > 0) await admin.from('atribuicoes_prof').delete().in('secao_id', secIds) } catch {}
    try { if (ofertaIds.length > 0) await admin.from('atribuicoes_prof').delete().in('curso_oferta_id', ofertaIds) } catch {}
    // Matriculas da turma
    try { await admin.from('matriculas').delete().eq('turma_id', turmaId) } catch {}
    // Seções da turma
    try { if (secIds.length > 0) await admin.from('secoes').delete().in('id', secIds) } catch {}
    // Ofertas da turma
    try { if (ofertaIds.length > 0) await admin.from('cursos_oferta').delete().in('id', ofertaIds) } catch {}
    // Por fim, turma
    const { error: delErr } = await admin.from('turmas').delete().eq('id', turmaId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'admin_escola', acao: 'TURMA_EXCLUIDA_CASCADE', entity: 'turma', entityId: turmaId, details: { secIds, ofertaIds, matIds } }).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
