const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5

const rateStore = new Map<string, number[]>()

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const normalizeAffiliate = (value: unknown) => normalizeText(value).toUpperCase() || null

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

  const { nome, escola, whatsapp, email, score, answers, afiliado } = body as {
    nome?: string
    escola?: string
    whatsapp?: string
    email?: string
    score?: number
    answers?: any
    afiliado?: string
    pathname?: string
    search?: string
    utm?: Record<string, string | null | undefined>
  }

  const nomeNormalizado = normalizeText(nome)
  const escolaNormalizada = normalizeText(escola)
  const whatsappNormalizado = normalizeText(whatsapp)
  const emailNormalizado = normalizeText(email).toLowerCase()
  const afiliadoNormalizado = normalizeAffiliate(afiliado)
  const scoreNormalizado = Number.isFinite(score) ? Math.max(0, Math.min(20, Number(score))) : 0
  const pathname = normalizeText((body as { pathname?: string }).pathname)
  const search = normalizeText((body as { search?: string }).search)
  const utm = typeof (body as { utm?: unknown }).utm === 'object' && (body as { utm?: unknown }).utm !== null ? (body as { utm?: Record<string, string | null | undefined> }).utm : {}

  if (!nomeNormalizado || !escolaNormalizada || !whatsappNormalizado || !emailNormalizado) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), { status: 500 })
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/marketing_leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      nome: nomeNormalizado,
      escola: escolaNormalizada,
      whatsapp: whatsappNormalizado,
      email: emailNormalizado,
      score: scoreNormalizado,
      respostas_json: answers,
      afiliado_codigo: afiliadoNormalizado,
      origem: 'diagnostico_gestao',
      metadata_json: {
        pathname,
        search,
        utm,
        referer: request.headers.get('referer'),
        user_agent: request.headers.get('user-agent'),
        ip,
      },
    }),
  })

  if (!response.ok) {
    console.error('Erro Supabase Lead:', await response.text())
    return new Response(JSON.stringify({ ok: false, error: 'upstream_error' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
