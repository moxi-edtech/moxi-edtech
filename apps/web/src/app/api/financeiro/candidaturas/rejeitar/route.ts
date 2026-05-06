import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { requireRoleInSchool } from '@/lib/authz'
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

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const { id, motivo } = parsed.data

    const { data: cand } = await supabase
      .from('candidaturas')
      .select('id, escola_id')
      .eq('id', id)
      .maybeSingle()

    if (!cand) return NextResponse.json({ ok: false, error: 'Candidatura não encontrada' }, { status: 404 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, cand.escola_id)
    if (!escolaId || escolaId !== cand.escola_id) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ['financeiro', 'admin', 'admin_escola', 'staff_admin'],
    })
    if (authError) return authError

    const motivoFinal = motivo || 'Pagamento não localizado'
    const { error: rejectErr } = await supabase.rpc('admissao_reject', {
      p_escola_id: escolaId,
      p_candidatura_id: id,
      p_motivo: motivoFinal,
      p_metadata: {
        origem: 'financeiro_candidaturas_rejeitar',
        rejeicao: { motivo: motivoFinal, data: new Date().toISOString() },
      },
    })

    if (rejectErr) return NextResponse.json({ ok: false, error: rejectErr.message }, { status: 400 })

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

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
