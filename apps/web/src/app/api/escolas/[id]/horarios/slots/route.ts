import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SlotSchema = z.object({
  id: z.string().uuid().optional(),
  turno_id: z.string().min(1),
  ordem: z.number().int().min(1),
  inicio: z.string(),
  fim: z.string(),
  dia_semana: z.number().int().min(1).max(7),
  is_intervalo: z.boolean().optional(),
  nome: z.string().optional().nullable(),
})

const PayloadSchema = z.object({
  slots: z.array(SlotSchema),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { data, error } = await supabase
      .from('horario_slots')
      .select('id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo, escola_id')
      .eq('escola_id', escolaIdResolved)
      .order('dia_semana', { ascending: true })
      .order('ordem', { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const response = NextResponse.json({ ok: true, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const parsed = PayloadSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const payload = parsed.data.slots.map((slot) => ({
      id: slot.id,
      escola_id: escolaIdResolved,
      turno_id: slot.turno_id,
      ordem: slot.ordem,
      inicio: slot.inicio,
      fim: slot.fim,
      dia_semana: slot.dia_semana,
      is_intervalo: slot.is_intervalo ?? false,
    }))

    const { data, error } = await supabase
      .from('horario_slots')
      .upsert(payload, { onConflict: 'id' })
      .select('id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const response = NextResponse.json({ ok: true, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
