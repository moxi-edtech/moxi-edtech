import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

/**
 * Aplica uma regra (curso/classe/escola) aos alunos existentes:
 * Body: { curso_id?, classe_id?, valor: number, dia_vencimento?: number, scope?: 'future'|'all' }
 * - scope=future (default): atualiza apenas mensalidades pendentes a partir do mês atual
 */
export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { curso_id, classe_id, valor, dia_vencimento, scope = 'future' } = body || {}
    const newValor: number = Number(valor)
    const newDia: number | undefined = dia_vencimento != null ? Number(dia_vencimento) : undefined
    if (!Number.isFinite(newValor) || newValor <= 0) return NextResponse.json({ ok: false, error: 'Valor inválido' }, { status: 400 })

    // Resolve escola
    let escolaId: string | undefined
    const { data: prof } = await s.from('profiles' as any).select('current_escola_id, escola_id').eq('user_id', user.id).limit(1)
    escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await s.from('escola_users').select('escola_id').eq('user_id', user.id).limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth() + 1

    // Seleciona mensalidades alvo
    let mensalidades: Array<any> = []

    // Filtro base
    let base = s.from('mensalidades')
      .select('id, turma_id, ano_referencia, mes_referencia, data_vencimento')
      .eq('escola_id', escolaId)
      .eq('status', 'pendente')

    if (scope === 'future') {
      base = base.or(`ano_referencia.gt.${thisYear},and(ano_referencia.eq.${thisYear},mes_referencia.gte.${thisMonth})`)
    }

    // Aplica filtros por classe/curso
    if (classe_id) {
      // Obter turmas da classe usando view alinhada
      const { data: turmas, error: turmasErr } = await s
        .from('vw_turmas_para_matricula')
        .select('id')
        .eq('classe_id', classe_id)
        .eq('escola_id', escolaId)

      if (turmasErr) return NextResponse.json({ ok: false, error: turmasErr.message }, { status: 400 })

      const turmaIds = (turmas || []).map((t: any) => t.id)
      if (turmaIds.length === 0) return NextResponse.json({ ok: true, updated: 0, note: 'Sem turmas para a classe' })
      const { data } = await base.in('turma_id', turmaIds)
      mensalidades = data || []
    } else if (curso_id) {
      // Turmas ligadas ao curso (view já resolve curso_id)
      const { data: turmas, error: turmasErr } = await s
        .from('vw_turmas_para_matricula')
        .select('id')
        .eq('curso_id', curso_id)
        .eq('escola_id', escolaId)

      if (turmasErr) return NextResponse.json({ ok: false, error: turmasErr.message }, { status: 400 })

      const turmaIds = (turmas || []).map((x: any) => x.id)
      if (turmaIds.length === 0) return NextResponse.json({ ok: true, updated: 0, note: 'Sem turmas para o curso' })
      const { data } = await base.in('turma_id', turmaIds)
      mensalidades = data || []
    } else {
      const { data } = await base
      mensalidades = data || []
    }

    if (mensalidades.length === 0) return NextResponse.json({ ok: true, updated: 0 })

    // Atualiza em batches (ajustando dia para último dia do mês quando necessário)
    let updated = 0
    for (const m of mensalidades) {
      const venc = m.data_vencimento as string | null
      let newVenc: string | null = venc
      if (newDia && venc) {
        const d = new Date(venc)
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        const dd = Math.max(1, Math.min(31, Number(newDia)))
        const adj = Math.min(dd, last)
        const nv = new Date(d.getFullYear(), d.getMonth(), adj)
        newVenc = nv.toISOString().slice(0, 10)
      }
      const payload: any = { valor_previsto: Number(newValor.toFixed(2)) }
      if (newVenc) payload.data_vencimento = newVenc
      const { error } = await s.from('mensalidades').update(payload).eq('id', m.id)
      if (!error) updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
