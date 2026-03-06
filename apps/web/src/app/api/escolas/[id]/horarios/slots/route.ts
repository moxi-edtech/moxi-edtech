import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { applyKf2ListInvariants } from '@/lib/kf2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Formato de hora inválido (HH:MM ou HH:MM:SS)')

const SlotSchema = z.object({
  id: z.string().uuid().optional(),
  turno_id: z.string().min(1),
  ordem: z.number().int().min(1),
  inicio: TimeSchema,
  fim: TimeSchema,
  dia_semana: z.number().int().min(1).max(7),
  is_intervalo: z.boolean().optional(),
  nome: z.string().optional().nullable(),
})

const PayloadSchema = z.object({
  slots: z.array(SlotSchema),
})

type SlotPayload = z.infer<typeof SlotSchema>
type ExistingSlot = {
  id: string
  turno_id: string | null
  dia_semana: number | null
  inicio: string | null
  fim: string | null
  is_intervalo: boolean | null
}

type Conflict = {
  turno_id: string
  dia_semana: number
  inicio: string
  fim: string
  conflicting_with: { id?: string; inicio: string; fim: string }
}

function toSeconds(time: string): number {
  const [hh, mm, ss = '00'] = time.split(':')
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss)
}

function detectTemporalOverlap(slots: Array<{ id?: string; turno_id: string; dia_semana: number; inicio: string; fim: string }>): Conflict | null {
  const byGroup = new Map<string, Array<{ id?: string; inicio: string; fim: string }>>()
  for (const slot of slots) {
    const key = `${slot.turno_id}::${slot.dia_semana}`
    const arr = byGroup.get(key) || []
    arr.push({ id: slot.id, inicio: slot.inicio, fim: slot.fim })
    byGroup.set(key, arr)
  }

  for (const [key, group] of byGroup.entries()) {
    const [turno_id, dia] = key.split('::')
    const sorted = [...group].sort((a, b) => toSeconds(a.inicio) - toSeconds(b.inicio))
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]
      if (toSeconds(next.inicio) < toSeconds(current.fim)) {
        return {
          turno_id,
          dia_semana: Number(dia),
          inicio: next.inicio,
          fim: next.fim,
          conflicting_with: { id: current.id, inicio: current.inicio, fim: current.fim },
        }
      }
    }
  }

  return null
}

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

    let slotsQuery = supabase
      .from('horario_slots')
      .select('id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo, escola_id')
      .eq('escola_id', escolaIdResolved)

    slotsQuery = applyKf2ListInvariants(slotsQuery, {
      defaultLimit: 50,
      order: [
        { column: 'dia_semana', ascending: true },
        { column: 'ordem', ascending: true },
      ],
      tieBreakerColumn: 'id',
    })

    const { data, error } = await slotsQuery

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

    for (const slot of parsed.data.slots) {
      if (toSeconds(slot.inicio) >= toSeconds(slot.fim)) {
        return NextResponse.json(
          { ok: false, error: 'SLOT_TIME_RANGE_INVALID', detail: { inicio: slot.inicio, fim: slot.fim, turno_id: slot.turno_id, dia_semana: slot.dia_semana } },
          { status: 422 }
        )
      }
    }

    const nonIntervalPayload = parsed.data.slots
      .filter((slot) => !(slot.is_intervalo ?? false))
      .map((slot) => ({ id: slot.id, turno_id: slot.turno_id, dia_semana: slot.dia_semana, inicio: slot.inicio, fim: slot.fim }))

    const payloadConflict = detectTemporalOverlap(nonIntervalPayload)
    if (payloadConflict) {
      return NextResponse.json(
        { ok: false, error: 'SLOT_TEMPORAL_CONFLICT', detail: payloadConflict },
        { status: 409 }
      )
    }

    const turnoIds = Array.from(new Set(parsed.data.slots.map((slot) => slot.turno_id)))
    const dias = Array.from(new Set(parsed.data.slots.map((slot) => slot.dia_semana)))
    const upsertIds = parsed.data.slots.map((slot) => slot.id).filter((id): id is string => Boolean(id))

    const { data: existingSlots, error: existingError } = await supabase
      .from('horario_slots')
      .select('id, turno_id, dia_semana, inicio, fim, is_intervalo')
      .eq('escola_id', escolaIdResolved)
      .in('turno_id', turnoIds)
      .in('dia_semana', dias)

    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 400 })

    const existingNonInterval = ((existingSlots || []) as ExistingSlot[])
      .filter((slot) => !(slot.is_intervalo ?? false))
      .filter((slot) => slot.turno_id && slot.dia_semana && slot.inicio && slot.fim)
      .filter((slot) => !upsertIds.includes(slot.id))
      .map((slot) => ({
        id: slot.id,
        turno_id: String(slot.turno_id),
        dia_semana: Number(slot.dia_semana),
        inicio: String(slot.inicio),
        fim: String(slot.fim),
      }))

    const mergedConflict = detectTemporalOverlap([...existingNonInterval, ...nonIntervalPayload])
    if (mergedConflict) {
      return NextResponse.json(
        { ok: false, error: 'SLOT_TEMPORAL_CONFLICT', detail: mergedConflict },
        { status: 409 }
      )
    }

    const payload = parsed.data.slots.map((slot: SlotPayload) => ({
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

    if (error) {
      if (error.message?.includes('excl_horario_slots_temporal')) {
        return NextResponse.json({ ok: false, error: 'SLOT_TEMPORAL_CONFLICT', detail: error.message }, { status: 409 })
      }
      if (error.message?.includes('horario_slots_inicio_fim_check')) {
        return NextResponse.json({ ok: false, error: 'SLOT_TIME_RANGE_INVALID', detail: error.message }, { status: 422 })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    const response = NextResponse.json({ ok: true, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
