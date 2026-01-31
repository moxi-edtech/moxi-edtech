// app/api/secretaria/professores/export/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type EscolaUserRow = Database['public']['Tables']['escola_users']['Row']

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const url = new URL(req.url)
    const format = (url.searchParams.get('format') || 'csv').toLowerCase()
    const q = url.searchParams.get('q') || ''
    const days = url.searchParams.get('days') || '30'
    const cargo = url.searchParams.get('cargo') || ''

    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    const escolaId = user ? await resolveEscolaIdForUser(s, user.id) : null
    if (!escolaId) return NextResponse.json([])

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString()
    })()

    // Esta exportação usa como fonte usuarios vinculados como 'professor' no portal (escola_users + profiles)
    if (cargo && cargo !== 'professor') {
      return NextResponse.json([])
    }

    const cargoToPapels: Record<string, string[]> = {
      '': ['professor', 'admin_escola', 'admin', 'staff_admin', 'secretaria'],
      professor: ['professor'],
      diretor: ['admin_escola', 'admin', 'staff_admin'],
      coordenador: ['staff_admin'],
      assistente: ['secretaria'],
    }
    const papels = cargoToPapels[cargo as keyof typeof cargoToPapels] ?? ['professor']

    const { data: vinc, error: vincErr } = await s
      .from('escola_users')
      .select('user_id, created_at, papel')
      .eq('escola_id', escolaId)
      .in('papel', papels)
      .gte('created_at', since)
    if (vincErr) return NextResponse.json({ error: vincErr.message }, { status: 500 })
    const vincList = (vinc || []) as Array<Pick<EscolaUserRow, 'user_id' | 'created_at' | 'papel'>>
    const ids = vincList.map(v => v.user_id)
    if (ids.length === 0) return NextResponse.json([])

    const { data, error } = await (s as any).rpc('tenant_profiles_by_ids', { p_user_ids: ids })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let rows = (data ?? []) as ProfileRow[]

    const sinceMs = Date.parse(since)
    rows = rows.filter((row) => {
      if (!row.created_at) return true
      return Date.parse(String(row.created_at)) >= sinceMs
    })

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/
      if (uuidRe.test(q)) {
        rows = rows.filter((row) => String(row.user_id) === q)
      } else {
        const term = q.toLowerCase()
        rows = rows.filter((row) =>
          [row.nome, row.email, row.telefone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        )
      }
    }

    rows.sort((a, b) => {
      const aDate = a.created_at ? Date.parse(String(a.created_at)) : 0
      const bDate = b.created_at ? Date.parse(String(b.created_at)) : 0
      return bDate - aDate
    })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    
    if (format === 'json') {
      const res = NextResponse.json(rows)
      res.headers.set('Content-Disposition', `attachment; filename="professores_${ts}.json"`)
      return res
    }

    // Formato CSV
    const csvEscape = (val: unknown) => {
      const s = String(val ?? '')
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }
    
    const header = ['ID', 'User ID', 'Nome', 'Email', 'Telefone', 'Cargo', 'Número Login', 'Data Criação']
    const csv = [
      header.map(csvEscape).join(','), 
      ...rows.map((r) => {
        const vinc = vincList.find(v => v.user_id === r.user_id)
        const createdAt = vinc?.created_at || r.created_at
        const papel = vinc?.papel
        const cargoLabel = papel === 'professor'
          ? 'professor'
          : papel === 'secretaria'
            ? 'assistente'
            : papel === 'staff_admin'
              ? 'coordenador'
              : 'diretor'
        return [
          r.user_id,
          r.user_id,
          r.nome,
          r.email || '',
          r.telefone || '',
          cargoLabel,
          r.numero_login || '',
          createdAt
        ].map(csvEscape).join(',')
      })
    ].join('\n')
    
    return new NextResponse(csv, { 
      headers: { 
        'Content-Type': 'text/csv; charset=utf-8', 
        'Content-Disposition': `attachment; filename="professores_${ts}.csv"` 
      } 
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
