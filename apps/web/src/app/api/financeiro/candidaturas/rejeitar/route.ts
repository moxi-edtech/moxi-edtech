import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

const BodySchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const { id, motivo } = parsed.data

    // Recupera dados para preservar o JSON
    const { data: cand } = await supabase
      .from('candidaturas')
      .select('dados_candidato, escola_id')
      .eq('id', id)
      .maybeSingle()

    if (!cand || cand.escola_id !== escolaId) return NextResponse.json({ ok: false, error: 'Candidatura não encontrada' }, { status: 404 })

    const dados = (cand as any)?.dados_candidato || {}
    const dadosAtualizados = { ...dados, rejeicao: { motivo: motivo || 'Pagamento não localizado', data: new Date().toISOString() } }

    const { error: updateErr } = await supabase
      .from('candidaturas')
      .update({ status: 'rejeitada', dados_candidato: dadosAtualizados })
      .eq('id', id)
      .eq('escola_id', escolaId)

    if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 })

    // Notifica secretaria
    await supabase
      .from('notifications')
      .insert({
        escola_id: escolaId,
        target_role: 'secretaria' as any,
        tipo: 'candidatura_rejeitada',
        titulo: 'Pagamento rejeitado',
        mensagem: motivo || 'Pagamento não localizado/validado',
        link_acao: `/secretaria/candidaturas/${id}`,
      })
      .catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
