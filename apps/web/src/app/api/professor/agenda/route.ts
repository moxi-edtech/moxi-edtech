import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const { data: prof } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()

    if (!prof?.id) return NextResponse.json({ ok: true, items: [] })

    const { data: quadroRows, error: quadroErr } = await supabase
      .from('quadro_horarios')
      .select('slot_id, turma_id, disciplina_id, sala_id')
      .eq('escola_id', escolaId)
      .eq('professor_id', prof.id)

    if (quadroErr) return NextResponse.json({ ok: false, error: quadroErr.message }, { status: 400 })

    const slotIds = Array.from(new Set((quadroRows || []).map((r: any) => r.slot_id).filter(Boolean)))
    const turmaIds = Array.from(new Set((quadroRows || []).map((r: any) => r.turma_id).filter(Boolean)))
    const disciplinaIds = Array.from(new Set((quadroRows || []).map((r: any) => r.disciplina_id).filter(Boolean)))
    const salaIds = Array.from(new Set((quadroRows || []).map((r: any) => r.sala_id).filter(Boolean)))

    const [slotsRes, turmasRes, discRes, salasRes] = await Promise.all([
      slotIds.length
        ? supabase
            .from('horario_slots')
            .select('id, turno_id, ordem, inicio, fim, dia_semana, is_intervalo')
            .eq('escola_id', escolaId)
            .in('id', slotIds)
        : Promise.resolve({ data: [] as any[] }),
      turmaIds.length
        ? supabase
            .from('turmas')
            .select('id, nome, sala')
            .eq('escola_id', escolaId)
            .in('id', turmaIds)
        : Promise.resolve({ data: [] as any[] }),
      disciplinaIds.length
        ? supabase
            .from('disciplinas_catalogo')
            .select('id, nome')
            .eq('escola_id', escolaId)
            .in('id', disciplinaIds)
        : Promise.resolve({ data: [] as any[] }),
      salaIds.length
        ? supabase
            .from('salas')
            .select('id, nome')
            .eq('escola_id', escolaId)
            .in('id', salaIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const slotMap = new Map<string, any>()
    for (const s of (slotsRes as any).data || []) slotMap.set(s.id, s)
    const turmaMap = new Map<string, string>()
    const turmaSalaMap = new Map<string, string | null>()
    for (const t of (turmasRes as any).data || []) {
      turmaMap.set(t.id, t.nome)
      turmaSalaMap.set(t.id, t.sala ?? null)
    }
    const discMap = new Map<string, string>()
    for (const d of (discRes as any).data || []) discMap.set(d.id, d.nome)
    const salaMap = new Map<string, string>()
    for (const s of (salasRes as any).data || []) salaMap.set(s.id, s.nome)

    const items = (quadroRows || [])
      .map((row: any) => {
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
