import { createClient } from '@supabase/supabase-js';
import { AppyPayClient, configForSchool, PaymentError } from '@/lib/server/payments/providers/appypay/core';
import { boundedBody } from '@/lib/server/payments/providers/appypay/portal-broker';
import { decryptFlow, encryptFlow, flowConfig, validMetaSignature } from '@/lib/server/payments/providers/appypay/whatsapp-crypto';
import { handleTestFlow } from '@/lib/server/payments/providers/appypay/whatsapp-flow';
import { testStore } from '@/lib/server/payments/providers/appypay/whatsapp-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' };
export async function POST(request: Request) {
  let decrypted: ReturnType<typeof decryptFlow> | undefined;
  try {
    if (process.env.WHATSAPP_APPYPAY_TEST_ENABLED !== 'true') throw new PaymentError(503, 'Flow de teste indisponível');
    const config = flowConfig(process.env.WHATSAPP_APPYPAY_FLOW_CONFIG);
    const appy = configForSchool(process.env.APPYPAY_CONFIG, config.schoolId);
    if (appy.environment !== 'sandbox') throw new PaymentError(403, 'Flow exclusivo de homologação');
    const raw = await boundedBody(request, 32768);
    if (!validMetaSignature(raw, request.headers.get('x-hub-signature-256'), config.appSecret)) throw new PaymentError(432, 'Assinatura inválida');
    decrypted = decryptFlow(raw, config.privateKey);
    if (decrypted.payload.action === 'ping') return new Response(encryptFlow({ data: { status: 'active' } }, decrypted.key, decrypted.iv), { headers });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new PaymentError(503, 'Flow de teste indisponível');
    // Machine-only endpoint: Meta signature + encryption + signed expiring test token.
    // This store never reads students, obligations or production payment tables.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await handleTestFlow(decrypted.payload, config, appy, testStore(db), new AppyPayClient(appy));
    return new Response(encryptFlow(result, decrypted.key, decrypted.iv), { headers });
  } catch (error) {
    // A data_exchange error must not navigate backwards against the Flow routing model.
    if (decrypted && decrypted.payload.screen !== 'REFERENCE') return new Response(encryptFlow({ version: '3.0', screen: 'START', data: {
      error_message: error instanceof PaymentError ? error.message : 'Teste indisponível. Aguarde verificação.' } }, decrypted.key, decrypted.iv), { headers });
    return new Response('Flow indisponível', { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}
