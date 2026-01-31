import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
    const resolvedEscolaId = await resolveEscolaIdForUser(
      s as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    )

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Query scoped views (RLS function handles tenant)
    const [{ data: topT }, { data: topC }] = await Promise.all([
      s
        .from('vw_top_turmas_hoje' as any)
        .select('turma_nome, percent')
        .eq('escola_id', resolvedEscolaId)
        .order('percent', { ascending: false })
        .limit(10),
      s
        .from('vw_top_cursos_media' as any)
        .select('curso_nome, media')
        .eq('escola_id', resolvedEscolaId)
        .order('media', { ascending: false })
        .limit(10),
    ])

    const res = NextResponse.json({
      ok: true,
      topTurmas: (topT || []).map((r: any) => ({ turma_nome: r.turma_nome, percent: Number(r.percent) || 0 })),
      topCursos: (topC || []).map((r: any) => ({ curso_nome: r.curso_nome, media: Number(r.media) || 0 })),
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
