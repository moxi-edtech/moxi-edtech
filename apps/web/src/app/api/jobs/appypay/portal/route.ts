import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppyPayClient, PaymentError, configForSchool } from '@/lib/server/payments/providers/appypay/core';
import { boundedBody, uuid, verifyBroker, type PortalCommand } from '@/lib/server/payments/providers/appypay/portal-broker';
import { portalOperation } from '@/lib/server/payments/providers/appypay/portal-operations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
    const raw = await boundedBody(request);
    const schoolId = JSON.parse(process.env.APPYPAY_CONFIG ?? 'null')?.schoolId;
    const config = configForSchool(process.env.APPYPAY_CONFIG, schoolId);
    if (!verifyBroker(raw, request.headers.get('x-appypay-time'), request.headers.get('x-appypay-signature'), config.clientSecret)) throw new PaymentError(401, 'Pedido interno não autorizado');
    const command: PortalCommand = JSON.parse(raw);
    if (!command || command.schoolId !== config.schoolId || !uuid.test(command.actorId ?? '') || !uuid.test(command.studentId ?? '') ||
        !['status', 'preview', 'issue', 'check'].includes(command.action) || (command.action !== 'status' &&
        (!['monthly', 'service'].includes(command.kind ?? '') || !uuid.test(command.targetId ?? ''))) ||
        (command.action === 'issue' && (typeof command.expectedAmount !== 'number' || !Number.isFinite(command.expectedAmount) || command.expectedAmount <= 0 || Number(command.expectedAmount.toFixed(2)) !== command.expectedAmount)) ||
        (command.action === 'check' && !uuid.test(command.referenceId ?? ''))) throw new PaymentError(400, 'Pedido inválido');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new PaymentError(503, 'Serviço indisponível');
    // Machine worker: identity/scope are signed by the authenticated student route, not accepted from the browser.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: student, error: studentError }, { data: provider, error: providerError }, { error: schemaError }] = await Promise.all([
      db.from('alunos').select('id').eq('id', command.studentId).eq('escola_id', config.schoolId).maybeSingle(),
      db.from('school_payment_providers').select('id,environment').eq('school_id', config.schoolId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle(),
      db.from('appypay_service_references').select('id').limit(1),
    ]);
    if (studentError || providerError || schemaError) throw new PaymentError(503, 'Pagamento indisponível');
    if (!student || !provider || provider.environment !== config.environment) throw new PaymentError(403, 'Pagamento indisponível para este aluno');
    const result = command.action === 'status' ? { enabled: true, schoolId: config.schoolId }
      : await portalOperation(db, new AppyPayClient(config), command, provider.id);
    return NextResponse.json({ ok: true, environment: config.environment, ...result }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PaymentError ? error.message : 'Pagamento indisponível; consulte o estado' },
      { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}
