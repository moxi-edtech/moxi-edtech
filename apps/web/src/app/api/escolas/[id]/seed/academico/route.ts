import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const hdr = req.headers.get('x-test-seed-key') || ''
  if (!process.env.TEST_SEED_KEY || hdr !== process.env.TEST_SEED_KEY) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const token = process.env.TEST_SEED_KEY || process.env.CRON_SECRET
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const raw = await req.text()
  const { id } = await context.params
  const origin = new URL(req.url).origin

  const res = await fetch(`${origin}/api/jobs/escolas/${id}/seed/academico`, {
    method: 'POST',
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      'x-job-token': token,
    },
    body: raw,
    cache: 'no-store',
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
