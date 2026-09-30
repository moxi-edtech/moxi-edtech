import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from '@/lib/academic-year/context'
import { resolveProfessorAcademicContext } from '@/lib/professor/resolveProfessorAcademicContext'

const Query = z.object({
  turma_id: z.string().uuid(),
})

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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
    const academicContext = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: new URL(req.url).searchParams.get('ano_letivo_id'),
      operation: 'READ',
    })
    await assertAcademicYearEntity(supabase as any, {
      table: 'turmas', entityId: parsed.data.turma_id,
      escolaId: academicContext.escolaId, anoLetivoId: academicContext.anoLetivoId,
    })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, curso_id, classe_id, ano_letivo')
      .eq('id', parsed.data.turma_id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    const professorContext = await resolveProfessorAcademicContext({
      supabase,
      escolaId,
      userId: user.id,
      turmaId: turma.id,
    })
    if (!professorContext) {
      return NextResponse.json({ ok: false, error: 'Professor não atribuído à turma' }, { status: 403 })
    }

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_letivos')
      .select('id, numero, tipo, data_inicio, data_fim')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', academicContext.anoLetivoId)
      .eq('tipo', 'TRIMESTRE')
      .order('numero', { ascending: true })
      .order('id', { ascending: true })
      .limit(12)

    if (periodosError) {
      return NextResponse.json({ ok: false, error: periodosError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, context: academicContext, items: periodos || [] })
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
