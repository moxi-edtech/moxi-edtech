import { NextResponse } from 'next/server'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<any>()
    const url = new URL(req.url)

    const q = (url.searchParams.get('q') || '').trim()
    const days = (url.searchParams.get('days') || '30').trim()
    const cargo = (url.searchParams.get('cargo') || '').trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20))

    // Resolve usuário e escola alvo (igual outros endpoints da Secretaria)
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    let escolaId: string | undefined
    try {
      const { data: prof } = await s
        .from('profiles')
        .select('current_escola_id, escola_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined
      if (!escolaId) {
        const { data: vinc } = await s
          .from('escola_users')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1)
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined
      }
    } catch {}

    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 })

    // Verificar vínculo do usuário com a escola
    const { data: vincUser } = await s
      .from('escola_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1)
    if (!vincUser || vincUser.length === 0) {
      return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola' }, { status: 403 })
    }

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

    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Quando service role estiver configurada, usar para contornar RLS em profiles
    if (adminUrl && serviceRole) {
      const admin = createAdminClient<Database>(adminUrl, serviceRole)

      // 1) Buscar vínculos na escola pelos papéis desejados
      const { data: vinc, error: vincErr } = await (admin as any)
        .from('escola_users')
        .select('id, user_id, created_at, papel')
        .eq('escola_id', escolaId)
        .in('papel', papels)
        .gte('created_at', since)
      if (vincErr) return NextResponse.json({ ok: false, error: vincErr.message }, { status: 500 })

      const vincList = (vinc || []) as Array<{ id: string; user_id: string; created_at: string; papel: string }>
      const user_ids = vincList.map(v => v.user_id)
      if (user_ids.length === 0) return NextResponse.json({ ok: true, items: [], total: 0 })

      // 2) Consultar perfis destes usuários (com filtro q)
      let profilesQuery = (admin as any)
        .from('profiles')
        .select('user_id, nome, email, telefone, numero_login, created_at')
        .in('user_id', user_ids)
      if (q) {
        profilesQuery = profilesQuery.or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`)
      }

      // Paginação
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const [{ data: rows, error: rowsErr }, countRes] = await Promise.all([
        profilesQuery.order('created_at', { ascending: false }).range(from, to),
        (admin as any)
          .from('profiles')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', user_ids)
      ])
      if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 })

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
      const items = (rows || []).map((p: any) => {
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
      const total = (countRes as any)?.count ?? items.length
      return NextResponse.json({ ok: true, items, total })
    }

        // Fallback sem service role: tentar via cliente do usuário (pode retornar vazio por RLS)
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
    
        let profilesQuery = (s as any)
          .from('profiles')
          .select('user_id, nome, email, telefone, numero_login, created_at')
          .in('user_id', user_ids)
        if (q) {
          profilesQuery = profilesQuery.or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`)
        }
    
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1
        const [{ data: rows, error: rowsErr }, countRes] = await Promise.all([
          profilesQuery.order('created_at', { ascending: false }).range(from, to),
          (s as any).from('profiles').select('user_id', { count: 'exact', head: true }).in('user_id', user_ids)
        ])
        if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 })
    
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
        const items = (rows || []).map((p: any) => {
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
        const total = (countRes as any)?.count ?? items.length
        return NextResponse.json({ ok: true, items, total })  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
