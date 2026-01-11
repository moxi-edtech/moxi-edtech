import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { applyKf2ListInvariants } from '@/lib/kf2'

async function resolveEscolaId(
  s: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string
) {
  const { data: prof } = await s
    .from('profiles' as any)
    .select('current_escola_id, escola_id')
    .eq('user_id', userId)
    .limit(1)
  let escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as
    | string
    | undefined
  if (!escolaId) {
    const { data: vinc } = await s.from('escola_users').select('escola_id').eq('user_id', userId).limit(1)
    escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
  }
  return escolaId
}

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    const url = new URL(req.url)
    const onlyActive = url.searchParams.get('ativos') === 'true'

    let query = s
      .from('financeiro_itens')
      .select('id, nome, categoria, preco, controla_estoque, estoque_atual, ativo, created_at, updated_at')
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })

    if (onlyActive) query = query.eq('ativo', true)

    query = applyKf2ListInvariants(query, { defaultLimit: 200 })

    const { data, error } = await query
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

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const { nome, categoria = 'outros', preco, controla_estoque = false, estoque_atual = 0, ativo = true } = body || {}

    if (!nome || !preco) return NextResponse.json({ ok: false, error: 'Nome e preço são obrigatórios' }, { status: 400 })

    const payload = {
      escola_id: escolaId,
      nome: String(nome).trim(),
      categoria,
      preco: Number(Number(preco).toFixed(2)),
      controla_estoque: Boolean(controla_estoque),
      estoque_atual: Math.max(0, Number(estoque_atual) || 0),
      ativo: Boolean(ativo),
    }

    const { data, error } = await s.from('financeiro_itens').insert(payload as any).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const { id, nome, categoria, preco, controla_estoque, estoque_atual, ativo } = body || {}
    if (!id) return NextResponse.json({ ok: false, error: 'ID é obrigatório' }, { status: 400 })

    const { data: registro } = await s
      .from('financeiro_itens')
      .select('id, escola_id')
      .eq('id', id)
      .maybeSingle()
    if (!registro || (registro as any).escola_id !== escolaId)
      return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 })

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (nome !== undefined) updatePayload.nome = String(nome).trim()
    if (categoria !== undefined) updatePayload.categoria = categoria
    if (preco !== undefined) updatePayload.preco = Number(Number(preco).toFixed(2))
    if (controla_estoque !== undefined) updatePayload.controla_estoque = Boolean(controla_estoque)
    if (estoque_atual !== undefined) updatePayload.estoque_atual = Math.max(0, Number(estoque_atual) || 0)
    if (ativo !== undefined) updatePayload.ativo = Boolean(ativo)

    const { data, error } = await s
      .from('financeiro_itens')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, item: data })
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

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'ID é obrigatório' }, { status: 400 })

    const { data: registro } = await s
      .from('financeiro_itens')
      .select('id, escola_id')
      .eq('id', id)
      .maybeSingle()
    if (!registro || (registro as any).escola_id !== escolaId)
      return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 })

    const { error } = await s
      .from('financeiro_itens')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
