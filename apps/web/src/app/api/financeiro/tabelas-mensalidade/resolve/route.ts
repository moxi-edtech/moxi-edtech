import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveMensalidade } from '@/lib/financeiro/pricing'
import { applyKf2ListInvariants } from '@/lib/kf2'

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
        let alunoQuery = s.from('alunos').select('escola_id').eq('id', alunoId).order('created_at', { ascending: false }).limit(1)
        alunoQuery = applyKf2ListInvariants(alunoQuery, { defaultLimit: 1 })
        const { data: aluno } = await alunoQuery.maybeSingle()
        escolaId = (aluno as any)?.escola_id as string | undefined
      } catch {}
    }
    if (!escolaId) {
      const { data: prof } = await s
        .from('profiles' as any)
        .select('current_escola_id, escola_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
      if (!escolaId) {
        const { data: vinc } = await s.from('escola_users').select('escola_id').eq('user_id', user.id).limit(1)
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
      }
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Deriva curso por turma se necessário
    let efetivoCursoId = cursoId
    let efetivaClasseId = classeId

    // Preferir IDs resolvidos pela view, alinhando com vw_turmas_para_matricula
    if (turmaId && (!efetivoCursoId || !efetivaClasseId || !escolaId)) {
      let turmaQuery = s
        .from('vw_turmas_para_matricula')
        .select('curso_id, classe_id, escola_id')
        .eq('id', turmaId)

      turmaQuery = applyKf2ListInvariants(turmaQuery, {
        defaultLimit: 1,
        order: [{ column: 'id', ascending: false }],
      })

      const { data: turmaView } = await turmaQuery.maybeSingle()

      if (turmaView) {
        if (!escolaId) escolaId = (turmaView as any).escola_id as string | undefined
        if (!efetivoCursoId) efetivoCursoId = (turmaView as any).curso_id as string | undefined
        if (!efetivaClasseId) efetivaClasseId = (turmaView as any).classe_id as string | undefined
      }
    }

    if (!efetivoCursoId || !efetivaClasseId) {
      return NextResponse.json({ ok: false, error: 'Curso ou classe não encontrados para a turma' }, { status: 400 })
    }

    const resolved = await resolveMensalidade(s as any, escolaId as string, {
      classeId: efetivaClasseId,
      cursoId: efetivoCursoId,
    })
    return NextResponse.json({ ok: true, ...resolved })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
