import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(req: Request) {
  try {
    const s = (await supabaseServer()) as any
    const url = new URL(req.url)
    const format = (url.searchParams.get('format') || 'csv').toLowerCase()
    const q = url.searchParams.get('q') || ''
    const days = url.searchParams.get('days') || '30'

    const { data: prof } = await s.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
    const escolaId = (prof?.[0]?.escola_id ?? null) as string | null
    if (!escolaId) {
      return NextResponse.json([])
    }

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString()
    })()

    let query = s
      .from('pagamentos')
      .select('id, status, valor, metodo, referencia, created_at')
      .eq('escola_id', escolaId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/
      if (uuidRe.test(q)) {
        query = query.eq('id', q)
      } else {
        query = query.or(`status.ilike.%${q}%,metodo.ilike.%${q}%,referencia.ilike.%${q}%`)
      }
    }

    const { data, error } = await query
    const rows = (data ?? []) as any[]
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'json') {
      const res = NextResponse.json(rows)
      res.headers.set('Content-Disposition', `attachment; filename="pagamentos_${ts}.json"`)
      return res
    }

    const csvEscape = (val: any) => {
      const s = String(val ?? '')
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }
    const header = ['id','status','valor','metodo','referencia','created_at']
    const csv = [header.map(csvEscape).join(','), ...rows.map((r: any) => header.map(k => csvEscape(r[k])).join(','))].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pagamentos_${ts}.csv"` } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
