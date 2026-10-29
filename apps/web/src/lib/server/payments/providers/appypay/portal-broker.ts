import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, type AppyPayConfig } from './core';

export const brokerPath = '/api/jobs/appypay/portal';
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type PortalCommand = {
  action: 'status' | 'preview' | 'issue' | 'check';
  schoolId: string; studentId: string; actorId: string;
  kind?: 'monthly' | 'service'; targetId?: string; expectedAmount?: number; referenceId?: string;
};
export async function boundedBody(request: Request, limit = 4096): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new PaymentError(413, 'Pedido demasiado grande');
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError(400, 'Pedido inválido');
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new PaymentError(413, 'Pedido demasiado grande'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts).toString('utf8');
}
export function brokerSignature(body: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`POST\n${brokerPath}\n${timestamp}\n${body}`).digest('hex');
}
export function verifyBroker(body: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!timestamp || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60_000 || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(brokerSignature(body, timestamp, secret), 'hex'));
}
export async function callPortalBroker(command: PortalCommand, config: AppyPayConfig, http: typeof fetch = fetch) {
  const body = JSON.stringify(command), timestamp = String(Date.now());
  // Fixed application origin: never send the signature, cookies or provider credentials to a caller-selected host.
  const response = await http(`https://app.klasse.ao${brokerPath}`, { method: 'POST', body, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(45_000), headers: { 'Content-Type': 'application/json', 'x-appypay-time': timestamp,
      'x-appypay-signature': brokerSignature(body, timestamp, config.clientSecret) } });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new PaymentError(response.status >= 400 ? response.status : 503, result?.error || 'Pagamento indisponível. Consulte o estado antes de tentar novamente.');
  return result;
}
