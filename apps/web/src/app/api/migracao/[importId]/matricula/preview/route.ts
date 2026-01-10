import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { normalizeTurmaCode } from '@/lib/turma'

type Batch = {
  turma_nome: string
  turma_codigo: string
  total_alunos: number
  status: 'ready' | 'warning'
  turma_id: string | null
  ano_letivo: number | null
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await ctx.params
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolver escola
    let escolaId: string | undefined
    const url = new URL(req.url)
    escolaId = url.searchParams.get('escola_id') || undefined
    if (!escolaId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_escola_id, escola_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
      if (!escolaId) {
        const { data: vinc } = await supabase
          .from('escola_users')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1)
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
      }
    }
    if (!escolaId) return NextResponse.json({ ok: true, batches: [] })

    // Carregar staging agrupado
    const { data: staged, error: stagedError } = await supabase
      .from('vw_staging_alunos_summary')
      .select('turma_codigo, ano_letivo, total_alunos')
      .eq('import_id', importId)
      .eq('escola_id', escolaId)
    if (stagedError) throw stagedError;

    const groups = staged || []

    const codeSet = new Set<string>();
    groups.forEach((g) => {
      const code = normalizeTurmaCode(String(g.turma_codigo ?? ''))
      if (code) codeSet.add(code)
    })

    let turmas: any[] | null = []
    if (codeSet.size > 0) {
      const { data } = await supabase
        .from('vw_migracao_turmas_lookup')
        .select('id, nome, ano_letivo, turma_code')
        .eq('escola_id', escolaId)
        .in('turma_code', Array.from(codeSet))
      turmas = data as any[] | null
    }

    const batches: Batch[] = []
    for (const g of groups) {
      const code = normalizeTurmaCode(String(g.turma_codigo ?? ''))
      if (!code) continue
      const ready = (turmas || []).find((t: any) => {
        const sameCode = normalizeTurmaCode(String(t.turma_code ?? '')) === code
        const sameYear = g.ano_letivo != null ? String(t.ano_letivo) === String(g.ano_letivo) : true
        return sameCode && sameYear
      })

      batches.push({
        turma_nome: ready ? String(ready.nome) : code,
        turma_codigo: code,
        total_alunos: Number(g.total_alunos ?? 0),
        status: ready ? 'ready' : 'warning',
        turma_id: ready ? String(ready.id) : null,
        ano_letivo: g.ano_letivo ?? null,
      })
    }

    return NextResponse.json({ ok: true, batches })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
