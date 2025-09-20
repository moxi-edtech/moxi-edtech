import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { supabaseServer } from '@/lib/supabaseServer'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('perPage') || '20', 10)))

    // permission check via papel -> permission mapping
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    const { data: vinc } = await s.from('escola_usuarios').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'editar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: links, error } = await admin
      .from('escola_usuarios')
      .select('user_id, papel')
      .eq('escola_id', escolaId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const ids = (links || []).map(l => l.user_id)
    if (ids.length === 0) return NextResponse.json({ ok: true, users: [], page, perPage, total: 0 })

    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, email, nome')
      .in('user_id', ids)
    let users = (links || []).map(l => {
      const p = profiles?.find(pr => pr.user_id === l.user_id)
      return { user_id: l.user_id, papel: l.papel, email: p?.email || '', nome: p?.nome || '' }
    })
    if (q) {
      users = users.filter(u => u.email.toLowerCase().includes(q) || (u.nome || '').toLowerCase().includes(q))
    }
    const total = users.length
    const start = (page - 1) * perPage
    const paged = users.slice(start, start + perPage)
    return NextResponse.json({ ok: true, users: paged, page, perPage, total })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
