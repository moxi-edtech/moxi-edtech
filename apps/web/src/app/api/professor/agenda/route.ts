import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import type { Database } from '~types/supabase'

type QuadroRow = { slot_id: string | null; turma_id: string | null; disciplina_id: string | null; sala_id: string | null }
type SlotRow = { id: string; turno_id: string | null; ordem: number | null; inicio: string | null; fim: string | null; dia_semana: number | null; is_intervalo: boolean | null }
type TurmaRow = { id: string; nome: string | null; sala: string | null }
type DisciplinaRow = { id: string; nome: string | null }
type SalaRow = { id: string; nome: string | null }
type AssignmentRow = { turma_id: string | null; disciplina_id: string | null }

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const { data: prof } = await applyKf2ListInvariants(
      supabase
        .from('professores')
        .select('id')
        .eq('profile_id', user.id)
        .eq('escola_id', escolaId),
      { defaultLimit: 1 }
    ).maybeSingle()

    if (!prof?.id) return NextResponse.json({ ok: true, items: [] })

    const allowedPairs = new Set<string>()
    const { data: assignments } = await supabase
      .from('turma_disciplinas_professores')
      .select('turma_id, disciplina_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', prof.id)

    for (const row of ((assignments as AssignmentRow[]) || [])) {
      if (row.turma_id && row.disciplina_id) allowedPairs.add(`${row.turma_id}:${row.disciplina_id}`)
    }

    if (allowedPairs.size === 0) return NextResponse.json({ ok: true, items: [] })

    const { data: publishedVersions } = await supabase
      .from('horario_versoes')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('status', 'publicada')

    const publishedVersionIds = (publishedVersions || []).map((row: { id: string }) => row.id)
    if (publishedVersionIds.length === 0) return NextResponse.json({ ok: true, items: [] })

    const { data: quadroRows, error: quadroErr } = await applyKf2ListInvariants(
      supabase
        .from('quadro_horarios')
        .select('slot_id, turma_id, disciplina_id, sala_id')
        .eq('escola_id', escolaId)
        .eq('professor_id', prof.id)
        .in('versao_id', publishedVersionIds)
    )

    if (quadroErr) return NextResponse.json({ ok: false, error: quadroErr.message }, { status: 400 })

    const slotIds: string[] = Array.from(
      new Set((quadroRows || []).map((r: QuadroRow) => r.slot_id).filter((id): id is string => Boolean(id)))
    )
    const turmaIds: string[] = Array.from(
      new Set((quadroRows || []).map((r: QuadroRow) => r.turma_id).filter((id): id is string => Boolean(id)))
    )
    const disciplinaIds: string[] = Array.from(
      new Set((quadroRows || []).map((r: QuadroRow) => r.disciplina_id).filter((id): id is string => Boolean(id)))
    )
    const salaIds: string[] = Array.from(
      new Set((quadroRows || []).map((r: QuadroRow) => r.sala_id).filter((id): id is string => Boolean(id)))
    )

    const [slotsRes, turmasRes, discRes, salasRes] = await Promise.all([
      slotIds.length
        ? applyKf2ListInvariants(
            supabase
              .from('horario_slots')
              .select('id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo')
              .eq('escola_id', escolaId)
              .in('id', slotIds)
          )
        : Promise.resolve({ data: [] as SlotRow[] }),
      turmaIds.length
        ? applyKf2ListInvariants(
            supabase
              .from('turmas')
              .select('id, nome, sala')
              .eq('escola_id', escolaId)
              .in('id', turmaIds)
          )
        : Promise.resolve({ data: [] as TurmaRow[] }),
      disciplinaIds.length
        ? applyKf2ListInvariants(
            supabase
              .from('disciplinas_catalogo')
              .select('id, nome')
              .eq('escola_id', escolaId)
              .in('id', disciplinaIds)
          )
        : Promise.resolve({ data: [] as DisciplinaRow[] }),
      salaIds.length
        ? applyKf2ListInvariants(
            supabase
              .from('salas')
              .select('id, nome')
              .eq('escola_id', escolaId)
              .in('id', salaIds)
          )
        : Promise.resolve({ data: [] as SalaRow[] }),
    ])

    const slotMap = new Map<string, SlotRow>()
    for (const s of ((slotsRes as { data?: SlotRow[] }).data || [])) slotMap.set(s.id, s)
    const turmaMap = new Map<string, string | null>()
    const turmaSalaMap = new Map<string, string | null>()
    for (const t of ((turmasRes as { data?: TurmaRow[] }).data || [])) {
      turmaMap.set(t.id, t.nome ?? null)
      turmaSalaMap.set(t.id, t.sala ?? null)
    }
    const discMap = new Map<string, string | null>()
    for (const d of ((discRes as { data?: DisciplinaRow[] }).data || [])) discMap.set(d.id, d.nome ?? null)
    const salaMap = new Map<string, string | null>()
    for (const s of ((salasRes as { data?: SalaRow[] }).data || [])) salaMap.set(s.id, s.nome ?? null)

    const items = (quadroRows || [])
      .filter((row: QuadroRow) => {
        if (!row.turma_id || !row.disciplina_id) return false
        return allowedPairs.has(`${row.turma_id}:${row.disciplina_id}`)
      })
      .map((row: QuadroRow) => {
        if (!row.slot_id || !row.turma_id || !row.disciplina_id) return null
        const slot = slotMap.get(row.slot_id)
        if (!slot || slot.is_intervalo) return null
        return {
          slot_id: row.slot_id,
          turma_id: row.turma_id,
          disciplina_id: row.disciplina_id,
          turma_nome: turmaMap.get(row.turma_id) || null,
          disciplina_nome: discMap.get(row.disciplina_id) || null,
          sala_id: row.sala_id ?? null,
          sala_nome: row.sala_id
            ? salaMap.get(row.sala_id) || null
            : turmaSalaMap.get(row.turma_id) || null,
          dia_semana: slot.dia_semana,
          ordem: slot.ordem,
          inicio: slot.inicio,
          fim: slot.fim,
          turno: slot.turno_id,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
