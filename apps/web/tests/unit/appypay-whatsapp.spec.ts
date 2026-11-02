import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, generateKeyPairSync, createCipheriv, createDecipheriv, publicEncrypt, createHmac, constants } from 'node:crypto';
import { AppyPayClient, type AppyPayConfig, type Charge } from '../../src/lib/server/payments/providers/appypay/core';
import { decryptFlow, encryptFlow, validMetaSignature, sessionFromToken, testToken, TEST_SCHOOL, TEST_FLOW, TEST_PHONE, type FlowConfig, type FlowRequest } from '../../src/lib/server/payments/providers/appypay/whatsapp-crypto';
import { handleTestFlow } from '../../src/lib/server/payments/providers/appypay/whatsapp-flow';
import type { TestSession, TestStore } from '../../src/lib/server/payments/providers/appypay/whatsapp-store';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config: FlowConfig = { schoolId: TEST_SCHOOL, flowId: TEST_FLOW, phoneId: TEST_PHONE, appSecret: 'fixture-only-app-secret-0123456789',
  privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const appy: AppyPayConfig = { schoolId: TEST_SCHOOL, environment: 'sandbox', clientId: 'fixture-client', clientSecret: 'fixture-secret', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' };
function encrypted(payload: unknown) {
  const key = randomBytes(16), iv = randomBytes(16), c = createCipheriv('aes-128-gcm', key, iv);
  const body = JSON.stringify({ encrypted_flow_data: Buffer.concat([c.update(JSON.stringify(payload)), c.final(), c.getAuthTag()]).toString('base64'),
    encrypted_aes_key: publicEncrypt({ key: pair.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64'), initial_vector: iv.toString('base64') });
  return { key, iv, body, signature: 'sha256=' + createHmac('sha256', config.appSecret).update(body).digest('hex') };
}
class Memory implements TestStore {
  row?: TestSession;
  calls = 0;
  async ensure(row: TestSession) { this.calls++; if (!this.row) this.row = structuredClone(row); return this.current(row); }
  async current(row: TestSession) {
    assert.ok(this.row); assert.equal(this.row.id, row.id); assert.equal(this.row.school_id, row.school_id); assert.equal(this.row.token_hash, row.token_hash);
    return structuredClone(this.row);
  }
  async transition(row: TestSession, from: TestSession['state'], patch: Partial<TestSession>) {
    assert.ok(this.row); assert.equal(this.row.id, row.id); if (this.row.state !== from) return null;
    Object.assign(this.row, structuredClone(patch)); return structuredClone(this.row);
  }
}
function fixture() {
  const store = new Memory(), token = testToken(randomUUID(), config), id = randomUUID();
  let issueCount = 0, simulateCount = 0, getCount = 0, amount = 100, code = 100, timeout = false;
  let issued: { merchantId: string; reference: string; expiresAt: string };
  const client = {
    createReference: async (r: { amount: number; merchantId: string; reference: string; expiresAt: string }) => {
      issueCount++; assert.equal(r.amount, 100); issued = r;
      return { id, responseStatus: { successful: true, status: 'Pending', code: 101, source: 'REF', reference: { referenceNumber: r.reference, entity: '00348', dueDate: r.expiresAt } } } as Charge;
    },
    simulateReference: async () => { simulateCount++; if (timeout) throw new Error('uncertain'); },
    getCharge: async () => { getCount++; return { id, merchantTransactionId: issued.merchantId, amount, currency: 'AOA', responseStatus: { successful: true, code, status: code === 100 ? 'Success' : 'Pending', source: 'REF' } }; },
  };
  const run = (action: string, screen?: string, data?: Record<string, unknown>, flowToken = token) => handleTestFlow({ version: '3.0', action, screen, data, flow_token: flowToken }, config, appy, store, client);
  return { store, run, client, token, counts: () => ({ issueCount, simulateCount, getCount }), setAmount: (v: number) => { amount = v; }, setCode: (v: number) => { code = v; }, setTimeout: () => { timeout = true; } };
}
test('Meta HMAC, RSA OAEP SHA256, AES GCM and inverted response IV interoperate; tampering fails', () => {
  const request = encrypted({ version: '3.0', action: 'ping' });
  assert.equal(validMetaSignature(request.body, request.signature, config.appSecret), true);
  assert.equal(validMetaSignature(request.body + ' ', request.signature, config.appSecret), false);
  assert.equal(validMetaSignature(request.body, null, config.appSecret), false);
  const decrypted = decryptFlow(request.body, config.privateKey); assert.equal(decrypted.payload.action, 'ping');
  const value = Buffer.from(encryptFlow({ data: { status: 'active' } }, decrypted.key, decrypted.iv), 'base64');
  const inverse = Buffer.from(request.iv.map(n => n ^ 0xff)); const d = createDecipheriv('aes-128-gcm', request.key, inverse); d.setAuthTag(value.subarray(-16));
  assert.deepEqual(JSON.parse(Buffer.concat([d.update(value.subarray(0, -16)), d.final()]).toString()), { data: { status: 'active' } });
  const broken = JSON.parse(request.body); broken.encrypted_flow_data = Buffer.alloc(32).toString('base64');
  assert.throws(() => decryptFlow(JSON.stringify(broken), config.privateKey), /encriptado inválido/);
});
test('test tokens reject expiration, wrong school, flow, sender and modifications before persistence', async () => {
  const f = fixture();
  assert.throws(() => sessionFromToken(f.token, config, Date.now() + 31 * 60_000), /inválida/);
  for (const c of [{ ...config, schoolId: 'foreign' }, { ...config, flowId: 'foreign' }, { ...config, phoneId: 'foreign' }]) {
    await assert.rejects(f.run('INIT', undefined, undefined, testToken(randomUUID(), c)), /inválida/);
  }
  await assert.rejects(f.run('INIT', undefined, undefined, f.token + 'x'), /inválida/); assert.equal(f.store.calls, 0);
});
test('sandbox flow ignores client amount/school, reserves once under parallel requests and confirms only once', async () => {
  const f = fixture(); await f.run('INIT');
  const p = { action: 'issue_test_reference', amount: 999999, schoolId: 'foreign', aluno_id: 'foreign' };
  const results = await Promise.allSettled([f.run('data_exchange', 'START', p), f.run('data_exchange', 'START', p)]);
  assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal(f.counts().issueCount, 1);
  assert.equal(f.store.row?.reference_payload?.amount, 100); assert.equal(f.store.row?.school_id, TEST_SCHOOL);
  await f.run('data_exchange', 'START', p); assert.equal(f.counts().issueCount, 1);
  const paid = await f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' });
  assert.equal(paid.screen, 'STATUS'); assert.equal(f.store.row?.state, 'paid');
  await f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' }); assert.equal(f.counts().simulateCount, 1);
});
test('pending status and divergent charge never mark the sandbox session paid', async () => {
  const f = fixture(); await f.run('data_exchange', 'START', { action: 'issue_test_reference' }); f.setCode(101);
  const pending = await f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' }); assert.equal(pending.screen, 'REFERENCE');
  assert.equal(f.store.row?.state, 'simulating'); f.setCode(100); f.setAmount(99);
  await assert.rejects(f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' }), /não corresponde/);
  assert.equal(f.store.row?.state, 'simulating'); assert.equal(f.counts().simulateCount, 1);
});
test('uncertain simulation never repeats POST; a later authenticated GET can finish', async () => {
  const f = fixture(); await f.run('data_exchange', 'START', { action: 'issue_test_reference' }); f.setTimeout();
  await assert.rejects(f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' }), /uncertain/);
  assert.equal(f.store.row?.state, 'simulating');
  assert.equal((await f.run('data_exchange', 'REFERENCE', { action: 'simulate_test_payment' })).screen, 'STATUS');
  assert.equal(f.counts().simulateCount, 1);
});
test('uncertain issuance never repeats POST and production credentials cannot run the flow', async () => {
  const f = fixture(); const payload: FlowRequest = { version: '3.0', action: 'data_exchange', screen: 'START', flow_token: f.token, data: { action: 'issue_test_reference' } };
  let calls = 0; const failedClient = { ...f.client, createReference: async () => { calls++; throw new Error('uncertain'); } };
  await assert.rejects(handleTestFlow(payload, config, appy, f.store, failedClient), /uncertain/);
  await assert.rejects(handleTestFlow(payload, config, appy, f.store, failedClient), /verificação/); assert.equal(calls, 1);
  await assert.rejects(handleTestFlow(payload, config, { ...appy, environment: 'production' }, f.store, f.client), /homologação/);
});
test('simulator accepts empty successful HTTP bodies and never authenticates with production credentials', async () => {
  let requests = 0;
  const http = (async (url: string) => { requests++; if (url.includes('oauth2/token')) return Response.json({ access_token: 'fixture', expires_in: 3600 });
    assert.equal(url, 'https://gwy-api-tst.appypay.co.ao/v2.0/mocks/referenceProcessing'); return new Response(null, { status: 204 }); }) as typeof fetch;
  await new AppyPayClient(appy, http).simulateReference('00348', '123456789'); assert.equal(requests, 2);
  await assert.rejects(new AppyPayClient({ ...appy, environment: 'production' }, http).simulateReference('00348', '123456789'), /homologação/); assert.equal(requests, 2);
});
