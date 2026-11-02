import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateKeyPairSync, publicEncrypt, createCipheriv, createDecipheriv, constants, randomBytes, createHmac } from 'node:crypto';
import { TEST_SCHOOL, TEST_FLOW, TEST_PHONE } from '../../src/lib/server/payments/providers/appypay/whatsapp-crypto';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx'))('esbuild');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
test('Flow HTTP fails closed, bounds streams, authenticates before decryption and answers encrypted health without DB', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'klasse-flow-http-'));
  const keys = ['WHATSAPP_APPYPAY_TEST_ENABLED', 'WHATSAPP_APPYPAY_FLOW_CONFIG', 'APPYPAY_CONFIG', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const appSecret = 'fixture-meta-secret-0123456789';
  const config = { schoolId: TEST_SCHOOL, flowId: TEST_FLOW, phoneId: TEST_PHONE, appSecret, privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const make = (payload: unknown) => {
    const key = randomBytes(16), iv = randomBytes(16), cipher = createCipheriv('aes-128-gcm', key, iv);
    const body = JSON.stringify({ encrypted_flow_data: Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final(), cipher.getAuthTag()]).toString('base64'),
      encrypted_aes_key: publicEncrypt({ key: pair.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64'), initial_vector: iv.toString('base64') });
    const signature = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex');
    return { body, signature, key, iv };
  };
  try {
    const out = join(dir, 'route.mjs');
    await build({ entryPoints: [resolve(root, 'apps/web/src/app/api/jobs/whatsapp/flows/appypay/route.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'http-boundary', setup(b: { onResolve: Function; onLoad: Function }) {
      b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function createClient(){return {from(){throw new Error("Unexpected database query");}};}' }));
      b.onResolve({ filter: /^@\// }, (args: { path: string }) => ({ path: resolve(root, 'apps/web/src', args.path.slice(2) + '.ts') }));
    } }] });
    const route = await import(pathToFileURL(out).href);
    const request = (body: string, signature?: string) => new Request('https://fixture.invalid/api/jobs/whatsapp/flows/appypay', { method: 'POST', body, headers: signature ? { 'x-hub-signature-256': signature } : {} });
    process.env.WHATSAPP_APPYPAY_TEST_ENABLED = 'false'; assert.equal((await route.POST(request('{}'))).status, 503);
    process.env.WHATSAPP_APPYPAY_TEST_ENABLED = 'true'; process.env.WHATSAPP_APPYPAY_FLOW_CONFIG = JSON.stringify(config);
    process.env.APPYPAY_CONFIG = JSON.stringify({ schoolId: TEST_SCHOOL, environment: 'sandbox', clientId: 'fixture', clientSecret: 'fixture', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' });
    assert.equal((await route.POST(request('{}'))).status, 432);
    assert.equal((await route.POST(request('x'.repeat(32769)))).status, 413);
    const ping = make({ version: '3.0', action: 'ping' });
    assert.equal((await route.POST(request(ping.body + ' ', ping.signature))).status, 432);
    const corrupt = '{}', signature = 'sha256=' + createHmac('sha256', appSecret).update(corrupt).digest('hex');
    assert.equal((await route.POST(request(corrupt, signature))).status, 421);
    const response = await route.POST(request(ping.body, ping.signature)); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const bytes = Buffer.from(await response.text(), 'base64'); const decipher = createDecipheriv('aes-128-gcm', ping.key, Buffer.from(ping.iv.map(x => x ^ 0xff))); decipher.setAuthTag(bytes.subarray(-16));
    assert.deepEqual(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()]).toString()), { data: { status: 'active' } });
    const c = JSON.parse(process.env.APPYPAY_CONFIG); c.environment = 'production'; process.env.APPYPAY_CONFIG = JSON.stringify(c);
    assert.equal((await route.POST(request(ping.body, ping.signature))).status, 403);
  } finally { for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } await rm(dir, { recursive: true, force: true }); }
});
