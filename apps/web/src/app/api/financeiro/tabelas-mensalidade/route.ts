import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Lista e cria/atualiza regras de mensalidade por escola/curso/classe

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Resolve escola do usuário
    let escolaId: string | undefined
    const { data: prof } = await s
      .from('profiles' as any)
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .limit(1)
    escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await s.from('escola_usuarios').select('escola_id').eq('user_id', user.id).limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const { data, error } = await s
      .from('tabelas_mensalidade')
      .select('id, curso_id, classe_id, valor, dia_vencimento, ativo, created_at, updated_at')
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, items: data || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { curso_id, classe_id, valor, dia_vencimento, ativo = true } = body || {}
    if (!valor || Number(valor) <= 0) return NextResponse.json({ ok: false, error: 'Valor inválido' }, { status: 400 })

    // Resolve escola do usuário
    let escolaId: string | undefined
    const { data: prof } = await s
      .from('profiles' as any)
      .select('current_escola_id, escola_id')
      .eq('user_id', user.id)
      .limit(1)
    escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
    if (!escolaId) {
      const { data: vinc } = await s.from('escola_usuarios').select('escola_id').eq('user_id', user.id).limit(1)
      escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
    }
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    // Upsert por (escola, curso, classe)
    const payload = {
      escola_id: escolaId,
      curso_id: curso_id || null,
      classe_id: classe_id || null,
      valor: Number(Number(valor).toFixed(2)),
      dia_vencimento: dia_vencimento ? Math.max(1, Math.min(31, Number(dia_vencimento))) : null,
      ativo: Boolean(ativo),
      updated_at: new Date().toISOString(),
    } as any

    // Tenta encontrar existente
    const { data: exists } = await s
      .from('tabelas_mensalidade')
      .select('id')
      .eq('escola_id', escolaId)
      .is('curso_id', curso_id || null)
      .is('classe_id', classe_id || null)
      .limit(1)

    let result
    if (exists && exists.length > 0) {
      result = await s
        .from('tabelas_mensalidade')
        .update(payload)
        .eq('id', (exists[0] as any).id)
        .select()
        .single()
    } else {
      result = await s
        .from('tabelas_mensalidade')
        .insert(payload)
        .select()
        .single()
    }

    if ((result as any).error) {
      const err = (result as any).error
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, item: (result as any).data })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id') || null
    if (!id) return NextResponse.json({ ok: false, error: 'id é obrigatório' }, { status: 400 })

    // Valida que o registro pertence à escola do usuário
    const { data: reg } = await s
      .from('tabelas_mensalidade')
      .select('id, escola_id')
      .eq('id', id)
      .maybeSingle()
    if (!reg) return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 })

    // Soft delete: marca ativo=false
    const { error } = await s.from('tabelas_mensalidade').update({ ativo: false, updated_at: new Date().toISOString() } as any).eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
