const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5

const rateStore = new Map<string, number[]>()

function isRateLimited(ip: string) {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW_MS
  const entries = rateStore.get(ip)?.filter((timestamp) => timestamp > windowStart) ?? []
  entries.push(now)
  rateStore.set(ip, entries)
  return entries.length > RATE_MAX
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_payload' }), { status: 400 })
  }

  const { escola, provincia, municipio, alunos, contacto, website } = body as {
    escola?: string
    provincia?: string
    municipio?: string
    alunos?: string
    contacto?: string
    website?: string
  }

  if (website) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  if (!escola || !provincia || !municipio || !alunos || !contacto) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), { status: 500 })
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/onboarding_leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      escola,
      provincia,
      municipio,
      alunos_faixa: alunos,
      contacto,
      origem: 'landing',
    }),
  })

  if (!response.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_error' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
