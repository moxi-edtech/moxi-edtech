import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

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

export async function POST(req: Request) {
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaId(s, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const {
      aluno_id,
      item_id,
      quantidade,
      valor_unitario,
      desconto = 0,
      metodo_pagamento = 'numerario',
      descricao,
      status = 'pago',
    } = body || {}

    if (!aluno_id || !item_id) return NextResponse.json({ ok: false, error: 'Aluno e item são obrigatórios' }, { status: 400 })
    const qty = Number(quantidade)
    if (!qty || qty <= 0) return NextResponse.json({ ok: false, error: 'Quantidade inválida' }, { status: 400 })

    const { data, error } = await s.rpc('registrar_venda_avulsa', {
      p_escola_id: escolaId,
      p_aluno_id: aluno_id,
      p_item_id: item_id,
      p_quantidade: qty,
      p_valor_unit: Number(Number(valor_unitario ?? 0).toFixed(2)),
      p_desconto: Number(Number(desconto || 0).toFixed(2)),
      p_metodo_pagamento: metodo_pagamento,
      p_status: status,
      p_descricao: descricao,
      p_created_by: user.id,
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, result: data?.[0] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
