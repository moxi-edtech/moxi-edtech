import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizePedagogicalManage } from '@/lib/escola/disciplinas'
import { dispatchProfessorNotificacao } from '@/lib/notificacoes/dispatchProfessorNotificacao'

export const dynamic = 'force-dynamic'

const UUID = z.string().uuid()
const Body = z.object({
  professor_user_id: UUID,
  disciplina_id: UUID,
  itens: z.array(z.object({
    turma_id: UUID,
    curso_matriz_id: UUID,
  }).strict()).min(1).max(30),
}).strict().refine(
  (data) => new Set(data.itens.map((item) => item.turma_id)).size === data.itens.length,
  'Selecione cada turma uma única vez.',
)

async function context(escolaId: string) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return { error: NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 }) }
  const resolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
  if (resolved !== escolaId) {
    return { error: NextResponse.json({ ok: false, error: 'Sem acesso a esta escola' }, { status: 403 }) }
  }
  const permission = await authorizePedagogicalManage(supabase as any, escolaId, user.id)
  if (!permission.allowed) {
    return { error: NextResponse.json({ ok: false, error: 'Sem permissão para gerir professores' }, { status: 403 }) }
  }
  return { supabase, user }
}

// GET: opções elegíveis no ano letivo ativo para uma disciplina do catálogo.
// A turma só é oferecida se contiver a disciplina na sua própria matriz.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  if (!UUID.safeParse(escolaId).success) {
    return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 400 })
  }
  const disciplinaId = new URL(req.url).searchParams.get('disciplina_id')
  if (!UUID.safeParse(disciplinaId).success) {
    return NextResponse.json({ ok: false, error: 'Selecione uma disciplina válida' }, { status: 400 })
  }
  try {
    const gate = await context(escolaId)
    if (gate.error) return gate.error
    const s = gate.supabase!

    const { data: year, error: yearError } = await s.from('anos_letivos')
      .select('id').eq('escola_id', escolaId).eq('ativo', true).limit(1).maybeSingle()
    if (yearError) throw yearError
    if (!year) return NextResponse.json({ ok: true, items: [], message: 'Não existe ano letivo ativo' })

    const { data: turmas, error: turmasError } = await s.from('turmas')
      .select('id,nome,turno')
      .eq('escola_id', escolaId)
      .or(`ano_letivo_id.eq.${year.id},session_id.eq.${year.id}`)
      .order('nome', { ascending: true })
      .limit(300)
    if (turmasError) throw turmasError
    if (!turmas?.length) return NextResponse.json({ ok: true, items: [] })

    const { data: matrizes, error: matrizError } = await s.from('curso_matriz')
      .select('id,curso_curriculo_id')
      .eq('escola_id', escolaId).eq('disciplina_id', disciplinaId!).limit(1000)
    if (matrizError) throw matrizError
    if (!matrizes?.length) return NextResponse.json({ ok: true, items: [] })

    const turmaIds = turmas.map((t: any) => t.id)
    const matrizIds = matrizes.map((m: any) => m.id)
    const [{ data: ofertas, error: ofertasError }, { data: links, error: linksError }] = await Promise.all([
      s.from('turma_disciplinas').select('turma_id,curso_matriz_id,professor_id')
        .eq('escola_id', escolaId).in('turma_id', turmaIds).in('curso_matriz_id', matrizIds)
        .limit(1000),
      s.from('turma_disciplinas_professores').select('turma_id,professor_id')
        .eq('escola_id', escolaId).in('turma_id', turmaIds).eq('disciplina_id', disciplinaId!)
        .limit(1000),
    ])
    if (ofertasError) throw ofertasError
    if (linksError) throw linksError

    const curriculoIds = [...new Set(matrizes.map((m: any) => m.curso_curriculo_id).filter(Boolean))]
    const { data: curriculos, error: curriculoError } = curriculoIds.length
      ? await s.from('curso_curriculos').select('id,status,version').eq('escola_id', escolaId).in('id', curriculoIds)
      : { data: [], error: null }
    if (curriculoError) throw curriculoError

    const curriculoById = new Map<string, any>((curriculos || []).map((c: any): [string, any] => [c.id, c]))
    const matrizById = new Map<string, any>(matrizes.map((m: any): [string, any] => [m.id, m]))
    const linkByTurma = new Map<string, string | null>((links || []).map((l: any): [string, string | null] => [l.turma_id, l.professor_id ?? null]))
    const candidates = new Map<string, any>()
    const anyAssigned = new Map<string, string>()
    for (const oferta of ofertas || []) {
      if (oferta.professor_id && !anyAssigned.has(oferta.turma_id)) {
        anyAssigned.set(oferta.turma_id, oferta.professor_id)
      }
    }

    for (const oferta of ofertas || []) {
      const matriz: any = matrizById.get(oferta.curso_matriz_id)
      const curriculo: any = matriz ? curriculoById.get(matriz.curso_curriculo_id) : null
      const prioridade = (curriculo?.status === 'draft' ? 200000 : curriculo?.status === 'published' ? 100000 : 0)
        + Number(curriculo?.version || 0)
      const current = candidates.get(oferta.turma_id)
      if (!current || prioridade > current.prioridade) {
        candidates.set(oferta.turma_id, {
          turma_id: oferta.turma_id,
          curso_matriz_id: oferta.curso_matriz_id,
          professor_id: linkByTurma.get(oferta.turma_id) ?? anyAssigned.get(oferta.turma_id) ?? oferta.professor_id ?? null,
          prioridade,
        })
      }
    }
    const items = turmas.flatMap((t: any) => {
      const oferta = candidates.get(t.id)
      return oferta ? [{
        turma_id: t.id,
        nome: t.nome ?? 'Turma',
        turno: t.turno ?? null,
        curso_matriz_id: oferta.curso_matriz_id,
        professor_id: oferta.professor_id,
      }] : []
    })
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao carregar turmas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params
  if (!UUID.safeParse(escolaId).success) return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 400 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })

  try {
    const gate = await context(escolaId)
    if (gate.error) return gate.error
    const s = gate.supabase!
    const user = gate.user
    const { data: professor, error: professorError } = await s.from('professores')
      .select('id,profile_id').eq('escola_id', escolaId)
      .eq('profile_id', parsed.data.professor_user_id).maybeSingle()
    if (professorError) throw professorError
    if (!professor?.id) return NextResponse.json({ ok: false, error: 'Professor não encontrado nesta escola' }, { status: 404 })

    // Uma RPC = uma transação. Um conflito reverte todas as alterações.
    const { data: inserted, error } = await s.rpc('assign_professor_turmas_disciplina_batch', {
      p_escola_id: escolaId,
      p_professor_id: professor.id,
      p_disciplina_id: parsed.data.disciplina_id,
      p_itens: parsed.data.itens,
    })
    if (error) {
      const conflict = /ASSIGN_BATCH_JA_ATRIBUIDA|ASSIGN_PROF_CARGA_EXCEEDED|ASSIGN_PROF_QUADRO_CONFLICT|ASSIGN_BATCH_DISCIPLINA_INCOMPATIVEL/.test(error.message)
      return NextResponse.json({ ok: false, error: conflict
        ? 'Uma das turmas já tem professor, não oferece esta disciplina ou tem conflito de horário/carga. Nenhuma atribuição foi alterada.'
        : error.message }, { status: conflict ? 409 : 400 })
    }
    if (Number(inserted) > 0) {
      // Uma única notificação agrupada, evitando N eventos de realtime.
      await dispatchProfessorNotificacao({
        escolaId,
        key: 'TURMA_ATRIBUIDA',
        params: { turmaNome: `${inserted} turmas`, actionUrl: '/professor/turmas' },
        recipientIds: [parsed.data.professor_user_id],
        actorId: user!.id,
        actorRole: 'secretaria',
        agrupamentoTTLHoras: 12,
      }).catch(() => null)
    }
    return NextResponse.json({ ok: true, atribuicoes_criadas: Number(inserted || 0) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao atribuir turmas' }, { status: 500 })
  }
}
