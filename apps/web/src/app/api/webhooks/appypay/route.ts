import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppyPayClient, configForSchool, PaymentError, type Reference } from '@/lib/server/payments/providers/appypay/core';
import { reconcileCharge, recoverPendingReference } from '@/lib/server/payments/providers/appypay/service';

// Machine callback, no human session: see EXC-SEC-001-B / EXC-SEC-002-A.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
async function readPayload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError(400, 'Payload inválido');
  let length = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) { await reader.cancel(); throw new PaymentError(413, 'Payload demasiado grande'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new PaymentError(400, 'Payload inválido'); }
}
export async function POST(request: Request) {
  try {
    if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
    const payload = await readPayload(request);
    if (typeof payload?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.id)) throw new PaymentError(400, 'Identificador inválido');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new PaymentError(503, 'Serviço indisponível');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    // All tenant/provider context comes from the server configuration, never the callback.
    let schoolId: string;
    try { schoolId = JSON.parse(process.env.APPYPAY_CONFIG ?? 'null')?.schoolId; }
    catch { throw new PaymentError(503, 'Configuração indisponível'); }
    const config = configForSchool(process.env.APPYPAY_CONFIG, schoolId);
    const { data: provider, error: providerError } = await db.from('school_payment_providers').select('id,environment')
      .eq('school_id', config.schoolId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle();
    if (providerError) throw new PaymentError(503, 'Serviço indisponível');
    if (!provider || provider.environment !== config.environment) throw new PaymentError(409, 'Provedor indisponível');
    const { data: reference, error } = await db.from('payment_references').select('*')
      .eq('school_id', config.schoolId).eq('provider_id', provider.id).eq('provider_reference_id', payload.id).maybeSingle();
    if (error) throw new PaymentError(503, 'Serviço indisponível');
    const client = new AppyPayClient(config);
    // A merchant id selects a pending local reservation, but only an authenticated GET
    // matching school/provider/merchant/amount/reference can bind it to this charge.
    let resolved: Reference | null = reference ?? await recoverPendingReference(db, client, config.schoolId, provider.id, payload.id, payload.merchantTransactionId);
    if (!resolved) {
      const { data: serviceReference, error: serviceError } = await db.from('appypay_service_references').select('*')
        .eq('school_id', config.schoolId).eq('provider_id', provider.id).eq('provider_reference_id', payload.id).maybeSingle();
      if (serviceError) throw new PaymentError(503, 'Serviço indisponível');
      resolved = serviceReference ? { ...serviceReference, kind: 'service' } as Reference
        : await recoverPendingReference(db, client, config.schoolId, provider.id, payload.id, payload.merchantTransactionId, 'service');
    }
    if (!resolved) throw new PaymentError(503, 'Referência ainda não disponível');
    const result = await reconcileCharge(db, client, resolved as Reference);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PaymentError ? error.message : 'Falha ao verificar pagamento' },
      { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}
