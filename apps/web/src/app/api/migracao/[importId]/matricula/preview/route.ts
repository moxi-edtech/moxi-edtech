import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'

type Batch = {
  turma_nome: string
  classe: string | null
  total_alunos: number
  status: 'ready' | 'warning'
  turma_id: string | null
  // atributos necessários para /api/matriculas/massa
  curso_codigo: string | null
  classe_numero: number | null
  turno_codigo: string | null
  turma_letra: string | null
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
    const stagedQuery = supabase
      .from('staging_alunos')
      .select('curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo, count:id', { count: 'exact', head: false } as any)
      .eq('import_id', importId)
      .eq('escola_id', escolaId);

    const { data: staged } = await (stagedQuery as any).group(
      'curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo'
    );

    const groups = (staged || []) as Array<{ curso_codigo?: string | null; classe_numero?: number | null; turno_codigo?: string | null; turma_letra?: string | null; ano_letivo?: number | null; count?: number }>

    // Pré-carregar classes e turmas
    const { data: classes } = await supabase
      .from('classes')
      .select('id, numero, nome')
      .eq('escola_id', escolaId)
    const classByNumero = new Map<number, { id: string; nome: string }>()
    for (const c of (classes || []) as any[]) {
      if (c.numero != null) classByNumero.set(Number(c.numero), { id: c.id, nome: c.nome })
    }

    const { data: turmas } = await supabase
      .from('turmas')
      .select('id, nome, ano_letivo, turno, classe_id')
      .eq('escola_id', escolaId)

    const batches: Batch[] = []
    for (const g of groups) {
      const letra = (g.turma_letra || '').toString().trim().toUpperCase()
      const classeLabel = g.classe_numero != null ? `${g.classe_numero}ª Classe` : null
      const turmaNomeSugerido = `${classeLabel ?? ''} ${letra}`.trim()
      const targetClasse = g.classe_numero != null ? classByNumero.get(Number(g.classe_numero)) : undefined

      // Resolver turma existente: mesmo ano_letivo, mesmo classe_id, mesmo turno (se disponível), nome terminando com letra
      const candidatos = (turmas || []).filter((t: any) => {
        const sameYear = g.ano_letivo != null ? String(t.ano_letivo) === String(g.ano_letivo) : true
        const sameClasse = targetClasse?.id ? t.classe_id === targetClasse.id : true
        const sameTurno = g.turno_codigo ? (t.turno || '').toString().toLowerCase().startsWith(g.turno_codigo.toLowerCase().startsWith('m') ? 'm' : g.turno_codigo.toLowerCase().startsWith('t') ? 't' : 'n') : true
        const endsWithLetter = letra ? String(t.nome || '').toUpperCase().trim().endsWith(` ${letra}`) : true
        return sameYear && sameClasse && sameTurno && endsWithLetter
      })

      const ready = candidatos[0]
      batches.push({
        turma_nome: ready ? String(ready.nome) : turmaNomeSugerido,
        classe: classeLabel,
        total_alunos: Number(g.count || 0),
        status: ready ? 'ready' : 'warning',
        turma_id: ready ? String(ready.id) : null,
        curso_codigo: g.curso_codigo ?? null,
        classe_numero: g.classe_numero ?? null,
        turno_codigo: g.turno_codigo ?? null,
        turma_letra: letra || null,
        ano_letivo: g.ano_letivo ?? null,
      })
    }

    return NextResponse.json({ ok: true, batches })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
