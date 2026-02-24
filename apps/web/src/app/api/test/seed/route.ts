import { NextRequest, NextResponse } from 'next/server'
import { callAuthAdminJob } from '@/lib/auth-admin-job'

export async function POST(req: NextRequest) {
  try {
    const hdr = req.headers.get('x-test-seed-key') || ''
    if (!process.env.TEST_SEED_KEY || hdr !== process.env.TEST_SEED_KEY) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }
    const seedPassword = process.env.TEST_SEED_PASSWORD || 'Passw0rd!'
    const result = await callAuthAdminJob(req, 'seedTest', { timestamp: Date.now(), seedPassword })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
