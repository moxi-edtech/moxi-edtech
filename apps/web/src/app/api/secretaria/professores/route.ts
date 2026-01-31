import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<any>()
    const url = new URL(req.url)

    const q = (url.searchParams.get('q') || '').trim()
    const days = (url.searchParams.get('days') || '30').trim()
    const cargo = (url.searchParams.get('cargo') || '').trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20))

    // Resolve usuário e escola alvo (igual outros endpoints da Secretaria)
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined
    const escolaId = await resolveEscolaIdForUser(
      s as any,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    )

    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 })

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date()
      dt.setDate(dt.getDate() - d)
      return dt.toISOString()
    })()

    // Mapear cargo (UI) -> papéis do portal
    const cargoToPapels: Record<string, string[]> = {
      '': ['professor', 'admin_escola', 'admin', 'staff_admin', 'secretaria'],
      professor: ['professor'],
      diretor: ['admin_escola', 'admin', 'staff_admin', 'professor'],
      coordenador: ['staff_admin', 'professor'],
      assistente: ['secretaria'],
    }
    const papels = cargoToPapels[cargo as keyof typeof cargoToPapels] ?? ['professor']

    const { data: vinc, error: vincErr } = await s
      .from('escola_users')
      .select('id, user_id, created_at, papel')
      .eq('escola_id', escolaId)
      .in('papel', papels)
      .gte('created_at', since)
    if (vincErr) return NextResponse.json({ ok: false, error: vincErr.message }, { status: 500 })

    const vincList = (vinc || []) as Array<{ id: string; user_id: string; created_at: string; papel: string }>
    const user_ids = vincList.map(v => v.user_id)
    if (user_ids.length === 0) return NextResponse.json({ ok: true, items: [], total: 0 })

    const { data: rows, error: rowsErr } = await (s as any)
      .rpc('tenant_profiles_by_ids', { p_user_ids: user_ids })

    if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 })

    const list = (rows || []) as Array<{
      user_id: string
      nome: string | null
      email: string | null
      telefone: string | null
      numero_login: string | null
      created_at: string | null
    }>

    const filtered = q
      ? list.filter((row) => {
          const term = q.toLowerCase()
          return [row.nome, row.email, row.telefone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        })
      : list

    filtered.sort((a, b) => {
      const aDate = a.created_at ? Date.parse(a.created_at) : 0
      const bDate = b.created_at ? Date.parse(b.created_at) : 0
      if (aDate !== bDate) return bDate - aDate
      return String(b.user_id).localeCompare(String(a.user_id))
    })

    const from = (page - 1) * pageSize
    const paged = filtered.slice(from, from + pageSize)

    const vincMap = new Map(vincList.map(v => [v.user_id, v]))
    const mapPapelToCargo = (p: string | undefined): string => {
      switch (p) {
        case 'professor': return 'professor'
        case 'secretaria': return 'assistente'
        case 'staff_admin': return 'coordenador'
        case 'admin':
        case 'admin_escola':
          return 'diretor'
        default:
          return 'professor'
      }
    }
    const items = paged.map((p: any) => {
      const vincData = vincMap.get(p.user_id)
      return {
        id: vincData?.id,
        user_id: p.user_id,
        nome: p.nome,
        email: p.email,
        telefone: p.telefone,
        cargo: mapPapelToCargo(vincData?.papel),
        created_at: vincData?.created_at || new Date().toISOString(),
        profiles: { numero_login: p.numero_login }
      }
    })
    const total = filtered.length
    return NextResponse.json({ ok: true, items, total })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
