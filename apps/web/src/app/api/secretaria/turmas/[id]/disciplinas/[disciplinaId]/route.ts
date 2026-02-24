import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { requireFeature } from '@/lib/plan/requireFeature'
import { HttpError } from '@/lib/errors'

// DELETE /api/secretaria/turmas/:id/disciplinas/:disciplinaId
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; disciplinaId: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const headers = new Headers()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId, disciplinaId } = await ctx.params

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    try {
      await requireFeature('doc_qr_code')
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status })
      }
      throw err
    }

    headers.set('Deprecation', 'true')
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`)

    const { error } = await supabase
      .from('turma_disciplinas_professores')
      .delete()
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('disciplina_id', disciplinaId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers })

    return NextResponse.json({ ok: true }, { headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
