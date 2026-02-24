import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function resolveJobToken() {
  return process.env.MCX_WEBHOOK_JOB_TOKEN || process.env.CRON_SECRET || '';
}

export async function POST(req: Request) {
  try {
    const token = resolveJobToken();
    if (!token) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const headerIdempotencyKey =
      req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key');

    const raw = await req.text();
    const payload = safeJson(raw) as { transactionId?: string; id?: string } | null;
    const payloadKey = payload?.transactionId || payload?.id;
    const idempotencyKey = headerIdempotencyKey || (payloadKey ? `mcx:${payloadKey}` : null);
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header é obrigatório' }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const signatureHeaders = {
      'x-mcx-signature': req.headers.get('x-mcx-signature') || '',
      'x-signature': req.headers.get('x-signature') || '',
      'x-webhook-signature': req.headers.get('x-webhook-signature') || '',
    };

    const res = await fetch(`${origin}/api/jobs/financeiro/pagamentos/mcx-webhook`, {
      method: 'POST',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        'x-job-token': token,
        'Idempotency-Key': idempotencyKey,
        ...signatureHeaders,
      },
      body: raw,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook Error:', message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
