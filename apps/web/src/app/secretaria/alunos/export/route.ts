import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import type { Database } from '~types/supabase'

type AlunoRow = Database['public']['Tables']['alunos']['Row']

export async function GET(req: Request) {
  try {
    const s = await supabaseServer()
    const url = new URL(req.url)
    const format = (url.searchParams.get('format') || 'csv').toLowerCase()
    const q = url.searchParams.get('q') || ''
    const days = url.searchParams.get('days') || '30'

    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    const escolaId = user ? await resolveEscolaIdForUser(s, user.id) : null
    if (!escolaId) return NextResponse.json([])

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString()
    })()

    let query = s
      .from('alunos')
      .select('id, nome, email, created_at')
      .eq('escola_id', escolaId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/
      if (uuidRe.test(q)) {
        query = query.or(`id.eq.${q}`)
      } else {
        query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
      }
    }

    const { data, error } = await query
    const rows = (data ?? []) as AlunoRow[]
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'json') {
      const res = NextResponse.json(rows)
      res.headers.set('Content-Disposition', `attachment; filename="alunos_${ts}.json"`)
      return res
    }

    const csvEscape = (val: unknown) => {
      const s = String(val ?? '')
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }
    const header = ['id','nome','email','created_at']
    const csv = [header.map(csvEscape).join(','), ...rows.map((r) => header.map(k => csvEscape(r[k as keyof AlunoRow])).join(','))].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="alunos_${ts}.csv"` } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
