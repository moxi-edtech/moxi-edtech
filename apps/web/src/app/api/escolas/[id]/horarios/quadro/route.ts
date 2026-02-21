import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BodySchema = z.object({
  versao_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  items: z.array(
    z.object({
      slot_id: z.string().uuid(),
      disciplina_id: z.string().uuid(),
      professor_id: z.string().uuid().nullable().optional(),
      sala_id: z.string().uuid().nullable().optional(),
    })
  ),
  mode: z.enum(["draft", "publish"]).optional(),
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

    const { searchParams } = new URL(req.url)
    const versaoId = searchParams.get('versao_id')
    const turmaId = searchParams.get('turma_id')
    if (!versaoId || !turmaId) {
      return NextResponse.json({ ok: false, error: 'versao_id e turma_id são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('quadro_horarios')
      .select('id, turma_id, disciplina_id, professor_id, sala_id, slot_id, versao_id')
      .eq('escola_id', escolaIdResolved)
      .eq('versao_id', versaoId)
      .eq('turma_id', turmaId)

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

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const payload = parsed.data.items.map((item) => ({
      escola_id: escolaIdResolved,
      turma_id: parsed.data.turma_id,
      disciplina_id: item.disciplina_id,
      professor_id: item.professor_id ?? null,
      sala_id: item.sala_id ?? null,
      slot_id: item.slot_id,
      versao_id: parsed.data.versao_id,
    }))

    const slotIds = Array.from(new Set(payload.map((item) => item.slot_id)))
    const professorIds = Array.from(new Set(payload.map((item) => item.professor_id).filter(Boolean)))
    const salaIds = Array.from(new Set(payload.map((item) => item.sala_id).filter(Boolean)))

    const conflicts: Array<{ slot_id: string; professor_id?: string | null; sala_id?: string | null }>
      = []
    if (slotIds.length > 0 && professorIds.length > 0) {
      const { data: profConflicts } = await supabase
        .from('quadro_horarios')
        .select('slot_id, professor_id')
        .eq('escola_id', escolaIdResolved)
        .in('slot_id', slotIds)
        .in('professor_id', professorIds as string[])

      for (const row of profConflicts || []) {
        conflicts.push({ slot_id: row.slot_id, professor_id: row.professor_id })
      }
    }

    if (slotIds.length > 0 && salaIds.length > 0) {
      const { data: salaConflicts } = await supabase
        .from('quadro_horarios')
        .select('slot_id, sala_id')
        .eq('escola_id', escolaIdResolved)
        .in('slot_id', slotIds)
        .in('sala_id', salaIds as string[])

      for (const row of salaConflicts || []) {
        conflicts.push({ slot_id: row.slot_id, sala_id: row.sala_id })
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Conflito de horário detectado', conflicts },
        { status: 409 }
      )
    }

    const mode = parsed.data.mode ?? "draft"
    if (mode === "publish") {
      const { data: cargas, error: cargasError } = await supabase
        .from("turma_disciplinas")
        .select(
          "carga_horaria_semanal, entra_no_horario, curso_matriz:curso_matriz_id(carga_horaria_semanal, entra_no_horario, disciplina_id, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(nome))"
        )
        .eq("escola_id", escolaIdResolved)
        .eq("turma_id", parsed.data.turma_id)

      if (cargasError) {
        return NextResponse.json({ ok: false, error: cargasError.message }, { status: 400 })
      }

      const disciplinaCounts: Record<string, number> = {}
      for (const item of parsed.data.items) {
        disciplinaCounts[item.disciplina_id] = (disciplinaCounts[item.disciplina_id] || 0) + 1
      }

      const missing: Array<{ disciplina_id: string; disciplina_nome?: string | null }> = []
      const mismatch: Array<{ disciplina_id: string; disciplina_nome?: string | null }> = []

      for (const row of cargas || []) {
        const disciplinaId = row.curso_matriz?.disciplina_id ?? null
        if (!disciplinaId) continue
        const entra = row.entra_no_horario ?? row.curso_matriz?.entra_no_horario ?? true
        if (!entra) continue
        const expected = row.carga_horaria_semanal ?? row.curso_matriz?.carga_horaria_semanal ?? 0
        const nome = row.curso_matriz?.disciplina?.nome ?? null

        if (expected <= 0) {
          missing.push({ disciplina_id: disciplinaId, disciplina_nome: nome })
          continue
        }

        const assigned = disciplinaCounts[disciplinaId] || 0
        if (assigned !== expected) {
          mismatch.push({ disciplina_id: disciplinaId, disciplina_nome: nome })
        }
      }

      if (missing.length > 0 || mismatch.length > 0) {
        return NextResponse.json(
          { ok: false, error: "CARGA_HORARIA_INCOMPLETA", details: { missing, mismatch } },
          { status: 400 }
        )
      }
    }

    const { error } = await supabase
      .from('quadro_horarios')
      .delete()
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', parsed.data.turma_id)
      .eq('versao_id', parsed.data.versao_id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const { data, error: insertError } = await supabase
      .from('quadro_horarios')
      .insert(payload)
      .select('id, turma_id, disciplina_id, professor_id, sala_id, slot_id, versao_id')

    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 })

    const response = NextResponse.json({ ok: true, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
