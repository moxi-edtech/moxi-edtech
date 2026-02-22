import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const Query = z.object({
  turma_id: z.string().uuid(),
})

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const turmaId = searchParams.get('turma_id')
    const parsed = Query.safeParse({ turma_id: turmaId })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const admin = getSupabaseServerClient()
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 500 })
    }

    const { data: professor } = await admin
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    const professorId = (professor as any)?.id as string | undefined
    if (!professorId) return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 403 })

    const { data: turma } = await admin
      .from('turmas')
      .select('id, curso_id, classe_id, ano_letivo')
      .eq('id', parsed.data.turma_id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    const { data: assignment } = await admin
      .from('turma_disciplinas')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turma.id)
      .eq('professor_id', professorId)
      .maybeSingle()

    let hasAccess = Boolean(assignment)
    if (!hasAccess) {
      const { data: tdp } = await admin
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('turma_id', turma.id)
        .eq('professor_id', professorId)
        .maybeSingle()
      hasAccess = Boolean(tdp)
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Professor não atribuído à turma' }, { status: 403 })
    }

    const { data: anoLetivo } = await admin
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('ano', turma.ano_letivo)
      .maybeSingle()

    if (!anoLetivo?.id) {
      return NextResponse.json({ ok: true, items: [] })
    }

    const { data: periodos, error: periodosError } = await admin
      .from('periodos_letivos')
      .select('id, numero, tipo, data_inicio, data_fim')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', anoLetivo.id)
      .eq('tipo', 'TRIMESTRE')
      .order('numero', { ascending: true })

    if (periodosError) {
      return NextResponse.json({ ok: false, error: periodosError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, items: periodos || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
