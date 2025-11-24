import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'

const Body = z.object({
  promocoes: z.array(z.object({ origem_turma_id: z.string().uuid(), destino_turma_id: z.string().uuid() })).optional(),
  concluir_turmas: z.array(z.object({ origem_turma_id: z.string().uuid() })).optional(),
})

// POST /api/secretaria/rematricula/confirmar
// Cria novas matrículas para turmas de destino e atualiza status das antigas.
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const json = await req.json().catch(() => ({}))
    const parsed = Body.safeParse(json)
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parsed.data

    // Resolve escola
    const { data: prof } = await supabase
      .from('profiles')
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await supabase
        .from('escola_usuarios')
        .select('escola_id')
        .eq('user_id', user.id)
        .limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Helper to load session_id from turma
    async function getSessionId(turmaId: string): Promise<string | null> {
      const { data } = await supabase.from('turmas').select('session_id').eq('id', turmaId).maybeSingle()
      return (data as any)?.session_id ?? null
    }

    // Process promotions
    if (body.promocoes && body.promocoes.length) {
      for (const p of body.promocoes) {
        const sessionId = await getSessionId(p.destino_turma_id)
        if (!sessionId) continue
        // alunos ativos na origem
        const { data: mats } = await supabase
          .from('matriculas')
          .select('aluno_id')
          .eq('escola_id', escolaId)
          .eq('turma_id', p.origem_turma_id)
          .in('status', ['ativo', 'ativa', 'active'])
        const alunoIds = (mats || []).map((m: any) => m.aluno_id).filter(Boolean)
        if (alunoIds.length === 0) continue

        // Cria novas matrículas no destino
        const inserts = alunoIds.map((aluno_id: string) => ({
          aluno_id,
          turma_id: p.destino_turma_id,
          session_id: sessionId,
          escola_id: escolaId,
          status: 'ativo',
        }))
        const { error: insErr } = await supabase.from('matriculas').insert(inserts as any)
        if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 })

        // Marca antigas como transferido
        await supabase
          .from('matriculas')
          .update({ status: 'transferido' })
          .eq('escola_id', escolaId)
          .eq('turma_id', p.origem_turma_id)
          .in('aluno_id', alunoIds)
      }
    }

    // Process conclusions for 12ª
    if (body.concluir_turmas && body.concluir_turmas.length) {
      for (const c of body.concluir_turmas) {
        await supabase
          .from('matriculas')
          .update({ status: 'concluido' })
          .eq('escola_id', escolaId)
          .eq('turma_id', c.origem_turma_id)
          .in('status', ['ativo', 'ativa', 'active'])
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

