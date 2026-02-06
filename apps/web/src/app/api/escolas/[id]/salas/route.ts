import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BodySchema = z.object({
  nome: z.string().trim().min(2),
  tipo: z.string().trim().optional().nullable(),
  capacidade: z.number().int().positive().optional().nullable(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { data, error } = await supabase
      .from('salas')
      .select('id, nome, tipo, capacidade')
      .eq('escola_id', escolaIdResolved)
      .order('nome', { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const response = NextResponse.json({ ok: true, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('salas')
      .insert({
        escola_id: escolaIdResolved,
        nome: parsed.data.nome,
        tipo: parsed.data.tipo ?? null,
        capacidade: parsed.data.capacidade ?? null,
      })
      .select('id, nome, tipo, capacidade')
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const response = NextResponse.json({ ok: true, item: data })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
