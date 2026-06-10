import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'

// GET /api/professor/materiais
// Lista os materiais (syllabi) que o professor pode ver/gerir
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: true, items: [] })

    // No momento, syllabi são globais por curso_oferta_id (que no DB é curso_id)
    const { data, error } = await supabase
      .from('syllabi')
      .select('*')
      .eq('escola_id', escolaId)
      .order('criado_em', { ascending: false })

    if (error) throw error

    return NextResponse.json({ ok: true, items: data || [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// POST /api/professor/materiais
// Cria um novo material
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) throw new Error('Escola não identificada')

    const body = await req.json()
    const { curso_id, nome, arquivo_url } = body

    if (!curso_id || !nome || !arquivo_url) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('syllabi')
      .insert({
        escola_id: escolaId,
        curso_oferta_id: curso_id,
        nome,
        arquivo_url
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
