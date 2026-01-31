import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { enqueueOutboxEvent, markOutboxEventFailed, markOutboxEventProcessed } from '@/lib/outbox'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid().optional(),
  turma_disciplina_id: z.string().uuid().optional(),
  periodo_letivo_id: z.string().uuid().optional(),
  trimestre: z.number().int().min(1).max(3).optional(),
  tipo_avaliacao: z.string().trim().min(2).max(40).optional(),
  disciplina_nome: z.string().optional(),
  notas: z.array(z.object({ aluno_id: z.string().uuid(), valor: z.number().min(0).max(100) })),
})

export async function POST(req: Request) {
  let supabase: any = null
  let outboxEventId: string | null = null
  try {
    supabase = await supabaseServerTyped<any>()
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

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    // A lógica de negócio foi movida para a RPC `lancar_notas_batch`.
    // A RPC irá validar as permissões, resolver/criar a avaliação,
    // e fazer o upsert das notas de forma atômica e auditada.
    const { data, error } = await supabase.rpc('lancar_notas_batch', {
      p_escola_id: escolaId,
      p_turma_id: body.turma_id,
      p_disciplina_id: body.disciplina_id,
      p_turma_disciplina_id: body.turma_disciplina_id,
      p_trimestre: body.trimestre ?? 1,
      p_tipo_avaliacao: body.tipo_avaliacao || 'MAC',
      p_notas: body.notas,
    });

    if (error) {
      console.error('Error calling lancar_notas_batch RPC:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (supabase) {
      await markOutboxEventFailed(supabase, outboxEventId, message).catch(() => null)
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
