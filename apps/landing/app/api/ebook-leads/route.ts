const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const rateStore = new Map<string, number[]>()

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function isRateLimited(ip: string) {
  const now = Date.now()
  const entries = (rateStore.get(ip) ?? []).filter((timestamp) => timestamp > now - RATE_WINDOW_MS)
  entries.push(now)
  rateStore.set(ip, entries)
  return entries.length > RATE_MAX
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const body = await request.json().catch(() => null) as {
    nome?: unknown
    escola?: unknown
    whatsapp?: unknown
    utm?: Record<string, string | null>
  } | null
  const nome = normalize(body?.nome)
  const escola = normalize(body?.escola)
  const whatsapp = normalize(body?.whatsapp)

  if (!nome || !escola || !whatsapp) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) return Response.json({ ok: true, tracked: false })

  const response = await fetch(`${supabaseUrl}/rest/v1/ebook_leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      nome,
      escola,
      whatsapp,
      utm_json: body?.utm ?? {},
      origem: 'ebook_matriculas_2026_2027',
      metadata_json: { pathname: '/ebook', ip, referer: request.headers.get('referer'), user_agent: request.headers.get('user-agent') },
    }),
  })

  if (!response.ok) return Response.json({ ok: false, error: 'upstream_error' }, { status: 500 })
  return Response.json({ ok: true, tracked: true })
}
