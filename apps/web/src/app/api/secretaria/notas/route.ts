import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import type { Database } from '~types/supabase'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid().optional(),
  turma_disciplina_id: z.string().uuid().optional(),
  trimestre: z.number().int().min(1).max(3),
  tipo_avaliacao: z.string().trim().min(2).max(40),
  notas: z.array(z.object({ aluno_id: z.string().uuid(), valor: z.number().min(0).max(100) })),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const idempotencyKey = req.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header is required' }, { status: 400 })
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data
    if (!body.disciplina_id || !body.turma_disciplina_id) {
      return NextResponse.json({ ok: false, error: 'Disciplina inválida para lançamento.' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { data, error } = await supabase.rpc('lancar_notas_batch', {
      p_escola_id: escolaId,
      p_turma_id: body.turma_id,
      p_disciplina_id: body.disciplina_id,
      p_turma_disciplina_id: body.turma_disciplina_id,
      p_trimestre: body.trimestre,
      p_tipo_avaliacao: body.tipo_avaliacao,
      p_notas: body.notas,
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
