import { constants, createDecipheriv, createCipheriv, createHash, createHmac, privateDecrypt, timingSafeEqual } from 'node:crypto';
import { PaymentError } from './core';

export const TEST_SCHOOL = 'f406f5a7-a077-431c-b118-297224925726';
export const TEST_FLOW = '2328444514659033';
export const TEST_PHONE = '1295106843688961';
export type FlowConfig = { schoolId: string; flowId: string; phoneId: string; appSecret: string; privateKey: string };
export type FlowRequest = { version: string; action: string; screen?: string; flow_token?: string; data?: Record<string, unknown> };
export function flowConfig(raw: string | undefined): FlowConfig {
  let c: FlowConfig;
  try { c = JSON.parse(raw ?? 'null'); } catch { throw new PaymentError(503, 'Flow indisponível'); }
  if (!c || c.schoolId !== TEST_SCHOOL || c.flowId !== TEST_FLOW || c.phoneId !== TEST_PHONE ||
    typeof c.appSecret !== 'string' || c.appSecret.length < 24 || typeof c.privateKey !== 'string' || !c.privateKey.includes('PRIVATE KEY')) throw new PaymentError(503, 'Flow indisponível');
  return c;
}
export function validMetaSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
function base64(value: unknown, max: number): Buffer {
  if (typeof value !== 'string' || !value.length || value.length > max || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new PaymentError(421, 'Pedido encriptado inválido');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new PaymentError(421, 'Pedido encriptado inválido');
  return decoded;
}
export function decryptFlow(raw: string, privateKey: string) {
  try {
    const body = JSON.parse(raw);
    const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, base64(body.encrypted_aes_key, 2048));
    const iv = base64(body.initial_vector, 64), encrypted = base64(body.encrypted_flow_data, 32768);
    if (key.length !== 16 || iv.length !== 16 || encrypted.length <= 16) throw new Error('invalid');
    const decipher = createDecipheriv('aes-128-gcm', key, iv);
    decipher.setAuthTag(encrypted.subarray(-16));
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8')) as FlowRequest;
    if (!payload || payload.version !== '3.0' || typeof payload.action !== 'string') throw new Error('invalid');
    return { payload, key, iv };
  } catch { throw new PaymentError(421, 'Pedido encriptado inválido'); }
}
export function encryptFlow(value: unknown, key: Buffer, iv: Buffer) {
  const inverse = Buffer.from(iv.map(byte => byte ^ 0xff));
  const cipher = createCipheriv('aes-128-gcm', key, inverse);
  return Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
export function testToken(sessionId: string, config: FlowConfig, expires = Date.now() + 30 * 60_000) {
  const claims = Buffer.from(JSON.stringify({ id: sessionId, exp: expires, school: config.schoolId, flow: config.flowId, phone: config.phoneId })).toString('base64url');
  const mac = createHmac('sha256', config.appSecret).update('klasse-appypay-test-v1.' + claims).digest('base64url');
  return claims + '.' + mac;
}
export function sessionFromToken(token: unknown, config: FlowConfig, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024) throw new PaymentError(403, 'Sessão de teste inválida');
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw new PaymentError(403, 'Sessão de teste inválida');
  const expected = createHmac('sha256', config.appSecret).update('klasse-appypay-test-v1.' + parts[0]).digest();
  if (!timingSafeEqual(expected, Buffer.from(parts[1], 'base64url'))) throw new PaymentError(403, 'Sessão de teste inválida');
  let c;
  try { c = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw new PaymentError(403, 'Sessão de teste inválida'); }
  if (!c || typeof c.id !== 'string' || !/^[a-f0-9-]{36}$/.test(c.id) || !Number.isFinite(c.exp) || c.exp <= now || c.exp > now + 30 * 60_000 ||
      c.school !== config.schoolId || c.flow !== config.flowId || c.phone !== config.phoneId) throw new PaymentError(403, 'Sessão de teste inválida');
  return { id: c.id as string, expiresAt: new Date(c.exp).toISOString(), tokenHash: createHash('sha256').update(token).digest('hex') };
}
