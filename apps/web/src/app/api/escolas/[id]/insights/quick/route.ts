import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    // Touch auth to ensure RLS context
    await s.auth.getUser()

    // Query scoped views (RLS function handles tenant)
    const [{ data: topT }, { data: topC }] = await Promise.all([
      s.from('v_top_turmas_hoje' as any).select('turma_nome, percent').limit(10),
      s.from('v_top_cursos_media' as any).select('curso_nome, media').limit(10),
    ])

    const res = NextResponse.json({
      ok: true,
      topTurmas: (topT || []).map((r: any) => ({ turma_nome: r.turma_nome, percent: Number(r.percent) || 0 })),
      topCursos: (topC || []).map((r: any) => ({ curso_nome: r.curso_nome, media: Number(r.media) || 0 })),
    })
    // Cache hints for edge/CDN
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

