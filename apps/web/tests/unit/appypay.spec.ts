import test from 'node:test';
import assert from 'node:assert/strict';
import { AppyPayClient, configForSchool, newReference, verifiedCharge, type AppyPayConfig, type Charge } from '../../src/lib/server/payments/providers/appypay/core';
import { issueReference, reconcileCharge, recoverPendingReference } from '../../src/lib/server/payments/providers/appypay/service';

const school = 'f406f5a7-a077-431c-b118-297224925726';
const config: AppyPayConfig = { schoolId: school, environment: 'sandbox', clientId: 'fixture-client', clientSecret: 'fixture-secret', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' };
const chargeId = '11111111-1111-4111-8111-111111111111';
const reference = () => ({ ...newReference(school, 'provider1', 'obligation1', 1500), provider_reference_id: chargeId, status: 'active' });
const paid = (r = reference()): Charge => ({ id: r.provider_reference_id, merchantTransactionId: r.provider_payload.merchant_id, amount: 1500, currency: 'AOA', responseStatus: { successful: true, status: 'Success', code: 100, source: 'REF' } });

// In-memory PostgREST contract double. No real tenant data or charges are touched.
class Store {
  tables: Record<string, any[]> = { mensalidades: [{ id: 'obligation1', escola_id: school, valor: 1500, valor_pago_total: 0, status: 'pendente' }], payment_references: [], payment_provider_events: [], finance_payment_intents: [], payment_provider_transactions: [] };
  confirms = 0;
  failTable = '';
  concurrentBalanceChange = false;
  from(table: string) {
    let op = 'select'; let payload: any; let options: any = {}; const predicates: ((r: any) => boolean)[] = [];
    const matches = () => this.tables[table].filter(r => predicates.every(p => p(r)));
    const run = () => {
      if (this.failTable === table) return { data: null, error: { message: 'unavailable' } };
      let result: any[] = [];
      if (op === 'select') result = matches();
      if (op === 'insert') {
        if (table === 'payment_references' && this.tables[table].some(r => r.school_id === payload.school_id && r.obligation_id === payload.obligation_id && ['pending', 'active'].includes(r.status))) return { data: null, error: { code: '23505' } };
        result = [payload]; this.tables[table].push(payload);
      }
      if (op === 'update') { result = matches(); result.forEach(r => Object.assign(r, payload)); }
      if (op === 'upsert') {
        const keys = options.onConflict.split(',');
        let row = this.tables[table].find(r => keys.every((key: string) => r[key] === payload[key]));
        if (!row) { row = { id: `row${this.tables[table].length}`, ...payload }; this.tables[table].push(row); }
        else if (!options.ignoreDuplicates) Object.assign(row, payload);
        result = [row];
      }
      return { data: result, error: null };
    };
    const q: any = {
      select: () => q, eq: (k: string, v: any) => { predicates.push(r => k === 'provider_payload->>merchant_id' ? r.provider_payload?.merchant_id === v : r[k] === v); return q; },
      neq: (k: string, v: any) => { predicates.push(r => r[k] !== v); return q; },
      in: (k: string, v: any[]) => { predicates.push(r => v.includes(r[k])); return q; },
      insert: (p: any) => { op = 'insert'; payload = p; return q; },
      update: (p: any) => { op = 'update'; payload = p; return q; },
      upsert: (p: any, o: any) => { op = 'upsert'; payload = p; options = o; return q; },
      maybeSingle: async () => { const r = run(); return { ...r, data: r.data?.[0] ?? null }; },
      single: async () => { const r = run(); return { ...r, data: r.data?.[0] ?? null, error: r.error ?? (r.data?.length !== 1 ? {} : null) }; },
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    }; return q;
  }
  async rpc(name: string, args: any) {
    assert.equal(name, 'appypay_confirm_payment');
    if (this.concurrentBalanceChange) return { data: null, error: { message: 'APPYPAY_BALANCE_CHANGED' } };
    const intent = this.tables.finance_payment_intents.find(r => r.id === args.p_intent_id);
    if (intent.status !== 'confirmed') { this.confirms++; intent.status = 'confirmed'; this.tables.mensalidades[0].valor_pago_total = 1500; }
    return { data: intent, error: null };
  }
}
const db = (s: Store) => s as any;
const clientFor = (charge: Charge) => ({ getCharge: async () => charge } as any);

test('configuration cannot be reused for another school or arbitrary environment/method', () => {
  assert.throws(() => configForSchool(JSON.stringify(config), 'other-school'), /esta escola/);
  assert.throws(() => configForSchool(JSON.stringify({ ...config, environment: 'preview' }), school));
  assert.throws(() => configForSchool(JSON.stringify({ ...config, paymentMethod: 'GPO_x' }), school));
  assert.throws(() => configForSchool('invalid', school));
});
test('OAuth encoding, environment, no-store and token reuse; credentials never appear in charge body', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const r = reference();
  const http = async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(String(url).includes('oauth2') ? { access_token: 'fixture-token', expires_in: '3600' } : paid(r)));
  };
  const client = new AppyPayClient({ ...config, clientSecret: 'secret &+=~' }, http as typeof fetch);
  await client.getCharge(chargeId); await client.getCharge(chargeId);
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /appypaydev/);
  assert.equal(new URLSearchParams(calls[0].init.body as URLSearchParams).get('client_secret'), 'secret &+=~');
  assert.match(calls[1].url, /gwy-api-tst/);
  assert.equal(calls[1].init.cache, 'no-store');
  assert.equal(calls[1].init.redirect, 'error');
  assert.equal((calls[1].init.headers as any).Authorization, 'Bearer fixture-token');
  assert.ok(!String(calls[1].init.body).includes('secret'));
});
test('production uses the documented production auth and gateway hosts', async () => {
  const urls: string[] = [];
  const client = new AppyPayClient({ ...config, environment: 'production' }, (async (u: any) => {
    urls.push(String(u)); return new Response(JSON.stringify(urls.length === 1 ? { access_token: 'token', expires_in: 3600 } : paid()));
  }) as any);
  await client.getCharge(chargeId);
  assert.equal(urls[0], 'https://login.microsoftonline.com/appypay.co.ao/oauth2/token');
  assert.equal(urls[1], `https://gwy-api.appypay.co.ao/v2.0/charges/${chargeId}`);
});
test('provider errors are redacted and financial POST is never retried', async () => {
  let calls = 0;
  const client = new AppyPayClient(config, (async () => { calls++; return new Response(JSON.stringify({ secret: 'must-not-leak' }), { status: 401 }); }) as any);
  await assert.rejects(client.getCharge(chargeId), error => !String(error).includes('must-not-leak'));
  assert.equal(calls, 1);
});
test('accepted code 101 is not a completed payment; amount, merchant, currency, ID and source must match', () => {
  const r = reference(); const c = paid(r);
  assert.equal(verifiedCharge(c, r), 'paid');
  assert.equal(verifiedCharge({ ...c, responseStatus: { ...c.responseStatus, code: 101 } }, r), 'pending');
  for (const mutation of [{ amount: 1500.01 }, { merchantTransactionId: 'forged' }, { currency: 'USD' }, { id: 'other' }, { responseStatus: { ...c.responseStatus, source: 'GPO' } }]) assert.throws(() => verifiedCharge({ ...c, ...mutation }, r));
});
test('creation reserves before external POST, returns public fields, and reuses active reference', async () => {
  const store = new Store(); let calls = 0;
  const client = { createReference: async (input: any) => {
    calls++; assert.equal(store.tables.payment_references.length, 1);
    assert.match(input.merchantId, /^[a-f0-9]{15}$/); assert.match(input.reference, /^\d{9}$/);
    return { id: chargeId, responseStatus: { successful: true, code: 101, reference: { entity: '00123', referenceNumber: input.reference, dueDate: input.expiresAt } } };
  } } as any;
  const a = await issueReference(db(store), client, school, 'provider1', 'obligation1');
  const b = await issueReference(db(store), client, school, 'provider1', 'obligation1');
  assert.equal(calls, 1); assert.deepEqual(a, b); assert.ok(!('provider_payload' in a));
});
test('concurrent issuers elect one creator; ambiguous failure blocks repeat creation', async () => {
  const store = new Store(); let calls = 0;
  const client = { createReference: async () => { calls++; throw new Error('timeout'); } } as any;
  await Promise.allSettled([issueReference(db(store), client, school, 'provider1', 'obligation1'), issueReference(db(store), client, school, 'provider1', 'obligation1')]);
  assert.equal(calls, 1);
  await assert.rejects(issueReference(db(store), client, school, 'provider1', 'obligation1'), /processamento/);
  assert.equal(calls, 1);
});
test('another tenant cannot create a charge for a foreign obligation; DB errors never call provider', async () => {
  const store = new Store(); let calls = 0; const client = { createReference: async () => calls++ } as any;
  await assert.rejects(issueReference(db(store), client, 'other-school', 'provider1', 'obligation1'));
  store.failTable = 'payment_references';
  await assert.rejects(issueReference(db(store), client, school, 'provider1', 'obligation1'));
  assert.equal(calls, 0);
});
test('forged notification data cannot settle: authoritative GET mismatch writes nothing', async () => {
  const store = new Store(); const r = reference();
  await assert.rejects(reconcileCharge(db(store), clientFor({ ...paid(r), amount: 1 }), r));
  assert.equal(store.confirms, 0); assert.equal(store.tables.payment_provider_events.length, 0);
});
test('duplicate callbacks confirm one intent and never reset its status', async () => {
  const store = new Store(); const r = reference(); store.tables.payment_references.push(r);
  const client = clientFor(paid(r));
  await reconcileCharge(db(store), client, r); await reconcileCharge(db(store), client, r);
  assert.equal(store.confirms, 1); assert.equal(store.tables.finance_payment_intents.length, 1);
  assert.equal(store.tables.finance_payment_intents[0].status, 'confirmed');
  assert.equal(store.tables.payment_provider_transactions.length, 1);
});
test('retry after post-confirm DB failure completes bookkeeping without confirming twice', async () => {
  const store = new Store(); const r = reference(); store.tables.payment_references.push(r);
  store.failTable = 'payment_provider_transactions';
  await assert.rejects(reconcileCharge(db(store), clientFor(paid(r)), r));
  assert.equal(store.confirms, 1); store.failTable = '';
  assert.equal((await reconcileCharge(db(store), clientFor(paid(r)), r)).status, 'reconciled');
  assert.equal(store.confirms, 1);
});
test('divergent current balance goes to manual review without settlement', async () => {
  const store = new Store(); const r = reference(); store.tables.mensalidades[0].valor_pago_total = 500;
  assert.equal((await reconcileCharge(db(store), clientFor(paid(r)), r)).status, 'manual_review');
  assert.equal(store.confirms, 0); assert.equal(store.tables.payment_provider_events[0].status, 'manual_review');
});

test('balance changing inside the database lock returns manual review, never a second payment', async () => {
  const store = new Store(); const r = reference(); store.concurrentBalanceChange = true;
  assert.equal((await reconcileCharge(db(store), clientFor(paid(r)), r)).status, 'manual_review');
  assert.equal(store.confirms, 0);
});

test('early webhook recovers a reservation only after authoritative identity and reference checks', async () => {
  const store = new Store(); const r = newReference(school, 'provider1', 'obligation1', 1500); store.tables.payment_references.push(r);
  const charge = { ...paid({ ...r, provider_reference_id: chargeId }), reference: { entity: '00123', referenceNumber: r.reference, dueDate: r.expires_at } };
  const recovered = await recoverPendingReference(db(store), clientFor(charge), school, 'provider1', chargeId, r.provider_payload.merchant_id);
  assert.equal(recovered?.provider_reference_id, chargeId);
  assert.equal(recovered?.status, 'active');
  assert.equal((await reconcileCharge(db(store), clientFor(charge), recovered!)).status, 'reconciled');
  assert.equal(store.confirms, 1);
});
test('forged merchant, foreign school and wrong reference cannot recover a pending reservation', async () => {
  const store = new Store(); const r = newReference(school, 'provider1', 'obligation1', 1500); store.tables.payment_references.push(r);
  let queries = 0; const client = { getCharge: async () => { queries++; return { ...paid({ ...r, provider_reference_id: chargeId }), reference: { entity: '00123', referenceNumber: '999999999', dueDate: r.expires_at } }; } } as any;
  assert.equal(await recoverPendingReference(db(store), client, 'foreign', 'provider1', chargeId, r.provider_payload.merchant_id), null);
  assert.equal(queries, 0);
  await assert.rejects(recoverPendingReference(db(store), client, school, 'provider1', chargeId, r.provider_payload.merchant_id));
  assert.equal(r.status, 'pending'); assert.equal(store.confirms, 0);
});
test('issuer returning after a successful early callback never changes paid back to active', async () => {
  const store = new Store();
  const client = { createReference: async (input: any) => {
    const r = store.tables.payment_references[0]; r.provider_reference_id = chargeId; r.entity = '00123'; r.status = 'paid';
    return { id: chargeId, responseStatus: { successful: true, code: 101, reference: { entity: '00123', referenceNumber: input.reference, dueDate: input.expiresAt } } };
  } } as any;
  const result = await issueReference(db(store), client, school, 'provider1', 'obligation1');
  assert.equal(result.status, 'paid'); assert.equal(store.tables.payment_references[0].status, 'paid');
});

test('amount changed after user preview is rejected before reservation or provider call', async () => {
  const store = new Store(); let posts = 0;
  const client = { createReference: async () => { posts++; } } as any;
  await assert.rejects(issueReference(db(store), client, school, 'provider1', 'obligation1', 1000), /saldo foi alterado/);
  assert.equal(posts, 0); assert.equal(store.tables.payment_references.length, 0);
});

test('duplicate callback preserves the original paid_at timestamp', async () => {
  const store = new Store(); const r = reference(); store.tables.payment_references.push(r);
  await reconcileCharge(db(store), clientFor(paid(r)), r);
  store.tables.payment_references[0].paid_at = '2026-10-01T09:00:00Z';
  await reconcileCharge(db(store), clientFor(paid(r)), r);
  assert.equal(store.tables.payment_references[0].paid_at, '2026-10-01T09:00:00Z');
  assert.equal(store.confirms, 1);
});
