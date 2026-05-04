import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const { escolaId, alunoId, matriculaId, anoLetivo: currentAno } = ctx

    if (!currentAno) {
      return NextResponse.json({ ok: false, eligible: false, reason: 'Ano letivo atual não identificado' })
    }

    // 1. Buscar próximo ano letivo
    const { data: nextAnoRow } = await supabase
      .from('anos_letivos')
      .select('id, ano')
      .eq('escola_id', escolaId)
      .gt('ano', currentAno)
      .order('ano', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!nextAnoRow) {
      return NextResponse.json({ ok: true, eligible: false, reason: 'Período de rematrícula não iniciado (Próximo ano não cadastrado)' })
    }

    const nextAno = nextAnoRow.ano

    // 2. Verificar se já existe rematrícula (candidatura ou matrícula) para o próximo ano
    const [existingCandidatura, existingMatricula] = await Promise.all([
      supabase
        .from('candidaturas')
        .select('id, status')
        .eq('aluno_id', alunoId)
        .eq('ano_letivo', nextAno)
        .not('status', 'eq', 'rejeitada')
        .maybeSingle(),
      supabase
        .from('matriculas')
        .select('id, status')
        .eq('aluno_id', alunoId)
        .eq('ano_letivo', nextAno)
        .maybeSingle()
    ])

    if (existingMatricula.data) {
      return NextResponse.json({ 
        ok: true, 
        eligible: false, 
        alreadyDone: true,
        reason: 'Rematrícula já efectivada para o próximo ano.' 
      })
    }

    if (existingCandidatura.data) {
      return NextResponse.json({ 
        ok: true, 
        eligible: false, 
        alreadyDone: true,
        status: existingCandidatura.data.status,
        reason: 'O seu pedido de rematrícula já está em análise pela secretaria.' 
      })
    }

    // 3. Verificação Financeira (Dívidas)
    const { data: mens } = await supabase
      .from('mensalidades')
      .select('id')
      .eq('aluno_id', alunoId)
      .in('status', ['pendente', 'atrasado'])
      .limit(1)

    const hasDebt = (mens?.length ?? 0) > 0

    return NextResponse.json({
      ok: true,
      eligible: true,
      nextAno,
      hasDebt,
      reason: hasDebt 
        ? 'Possui pendências financeiras que impedem a rematrícula automática.' 
        : 'Elegível para rematrícula.'
    })

  } catch (err: any) {
    console.error('Rematricula Status Error:', err)
    return NextResponse.json({ ok: false, error: 'Erro ao verificar elegibilidade' }, { status: 500 })
  }
}
