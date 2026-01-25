import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { hasPermission } from '@/lib/permissions'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') || '20', 10)))

    // permission check via papel -> permission mapping
    const supabase = await createRouteClient()
    const { data: userRes } = await supabase.auth.getUser()
    const requesterId = userRes?.user?.id
    if (!requesterId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, requesterId, escolaId)
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { data: vinc } = await supabase.from('escola_users').select('papel').eq('user_id', requesterId).eq('escola_id', escolaId).limit(1)
    const papelReq = vinc?.[0]?.papel as any
    if (!hasPermission(papelReq, 'editar_usuario')) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })

    let linksQuery = supabase
      .from('escola_users')
      .select('user_id, papel')
      .eq('escola_id', escolaId)

    linksQuery = applyKf2ListInvariants(linksQuery, { defaultLimit: 2000 })

    const { data: links, error } = await linksQuery
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    const ids = (links || []).map(l => l.user_id)
    if (ids.length === 0) return NextResponse.json({ ok: true, users: [], page, perPage, total: 0 })

    let profilesQuery = supabase
      .from('profiles')
      .select('user_id, email, nome')
      .in('user_id', ids)

    profilesQuery = applyKf2ListInvariants(profilesQuery, { defaultLimit: 2000 })

    const { data: profiles } = await profilesQuery
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
