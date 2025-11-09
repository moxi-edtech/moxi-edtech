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
    if (!escolaId) return NextResponse.json([])

    const since = (() => {
      const d = parseInt(days || '30', 10)
      if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
      const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString()
    })()

    let query = s
      .from('audit_logs')
      .select('id, created_at, portal, action, entity, entity_id, details')
      .eq('escola_id', escolaId)
      .eq('portal', 'financeiro')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`)

  const { data, error } = await query
  const logs = (data ?? []) as any[]
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'json') {
      const res = NextResponse.json(logs)
      res.headers.set('Content-Disposition', `attachment; filename="finance_audit_${ts}.json"`)
      return res
    }

    const csvEscape = (val: any) => {
      const s = typeof val === 'string' ? val : JSON.stringify(val)
      if (s == null) return ''
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }
    const header = ['created_at','action','entity','entity_id','details']
    const rows = logs.map((l: any) => [l.created_at, l.action, l.entity, l.entity_id ?? '', JSON.stringify(l.details || {})])
    const csv = [header.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="finance_audit_${ts}.csv"` } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
