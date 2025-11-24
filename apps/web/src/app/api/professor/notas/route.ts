import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  disciplina_nome: z.string().optional(),
  notas: z.array(z.object({ aluno_id: z.string().uuid(), valor: z.number().min(0).max(100) })),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const parsed = Body.safeParse(await req.json().catch(()=>({})))
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parsed.data

    const { data: prof } = await supabase.from('profiles').select('current_escola_id, escola_id').eq('user_id', user.id).maybeSingle()
    const escolaId = ((prof as any)?.current_escola_id || (prof as any)?.escola_id) as string | undefined
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Resolve disciplina_nome se não veio no body
    let disciplinaNome = body.disciplina_nome || null
    if (!disciplinaNome) {
      const { data: disc } = await supabase.from('disciplinas').select('nome').eq('id', body.disciplina_id).maybeSingle()
      disciplinaNome = (disc as any)?.nome ?? null
    }

    const rows = body.notas.map(n => ({
      escola_id: escolaId,
      aluno_id: n.aluno_id,
      turma_id: body.turma_id,
      disciplina_id: body.disciplina_id,
      disciplina: disciplinaNome, // fallback para páginas que consomem por texto
      nota: n.valor,
    }))

    const { error } = await supabase.from('notas').insert(rows as any)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

