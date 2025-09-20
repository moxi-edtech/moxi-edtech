import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // Must be admin of this escola
    let papel: string | null = null
    try {
      const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).maybeSingle()
      papel = (vinc as any)?.papel ?? null
    } catch {}
    if (!hasPermission(papel as any, 'configurar_escola')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    const TEST_SEED_KEY = process.env.TEST_SEED_KEY
    if (!TEST_SEED_KEY) return NextResponse.json({ ok: false, error: 'TEST_SEED_KEY ausente' }, { status: 500 })

    const base = process.env.NEXT_PUBLIC_BASE_URL || ''
    const payload = await req.json().catch(() => ({}))
    const res = await fetch(`${base}/api/escolas/${escolaId}/seed/academico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-seed-key': TEST_SEED_KEY },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

