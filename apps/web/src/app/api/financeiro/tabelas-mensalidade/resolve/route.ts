import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveMensalidade } from '@/lib/financeiro/pricing'

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const cursoId = url.searchParams.get('curso_id') || undefined
    const classeId = url.searchParams.get('classe_id') || undefined
    const turmaId = url.searchParams.get('turma_id') || undefined
    const alunoId = url.searchParams.get('aluno_id') || undefined

    // Resolve escola
    let escolaId: string | undefined
    if (alunoId) {
      try {
        const { data: aluno } = await s.from('alunos').select('escola_id').eq('id', alunoId).maybeSingle()
        escolaId = (aluno as any)?.escola_id as string | undefined
      } catch {}
    }
    if (!escolaId) {
      const { data: prof } = await s
        .from('profiles' as any)
        .select('current_escola_id, escola_id')
        .eq('user_id', user.id)
        .limit(1)
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
      if (!escolaId) {
        const { data: vinc } = await s.from('escola_usuarios').select('escola_id').eq('user_id', user.id).limit(1)
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
      }
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Deriva curso por turma se necessário
    let efetivoCursoId = cursoId
    if (!efetivoCursoId && turmaId) {
      const { data: co } = await s.from('cursos_oferta').select('curso_id').eq('turma_id', turmaId).limit(1)
      efetivoCursoId = (co?.[0] as any)?.curso_id as string | undefined
    }

    const resolved = await resolveMensalidade(s as any, escolaId, { classeId: classeId || undefined, cursoId: efetivoCursoId || undefined })
    return NextResponse.json({ ok: true, ...resolved })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

