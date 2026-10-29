import test from 'node:test';
import assert from 'node:assert/strict';
import { brokerSignature, verifyBroker, callPortalBroker, boundedBody, type PortalCommand } from '../../src/lib/server/payments/providers/appypay/portal-broker';
import { portalOperation } from '../../src/lib/server/payments/providers/appypay/portal-operations';
import { reconcileCharge } from '../../src/lib/server/payments/providers/appypay/service';
import { newReference } from '../../src/lib/server/payments/providers/appypay/core';
import { extractServicosFromPedidos, extractServicosFromPagamentos } from '../../src/lib/financeiro/servicosPagamento';

const school = 'f406f5a7-a077-431c-b118-297224925726';
const student = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const chargeId = '33333333-3333-4333-8333-333333333333';
const config = { schoolId: school, environment: 'sandbox' as const, clientId: 'fixture', clientSecret: 'fixture-secret', paymentMethod: 'REF_00000000-0000-0000-0000-000000000000' };
const command = (action: PortalCommand['action'] = 'preview'): PortalCommand => ({ action, schoolId: school, studentId: student, actorId: actor, kind: 'service', targetId: 'intent1', expectedAmount: 1500 });
class Memory {
  tables: Record<string, any[]> = {
    pagamento_intents: [{ id: 'intent1', escola_id: school, aluno_id: student, servico_pedido_id: 'order1', amount: 1500, currency: 'AOA', status: 'draft' }],
    servico_pedidos: [{ id: 'order1', escola_id: school, aluno_id: student, valor_cobrado: 1500, status: 'pending_payment' }],
    mensalidades: [{ id: 'monthly1', escola_id: school, aluno_id: student, valor: 1500, valor_pago_total: 500, status: 'pendente' }],
    pagamentos: [], payment_references: [], appypay_service_references: [], payment_provider_events: [],
  };
  confirmations = 0;
  from(table: string) {
    let op = 'select', payload: any; const filters: ((row: any) => boolean)[] = [];
    const run = () => {
      const rows = this.tables[table] ?? []; let data = rows.filter(r => filters.every(f => f(r)));
      if (op === 'insert') {
        if (rows.some(r => r.school_id === payload.school_id && r.obligation_id === payload.obligation_id && ['active', 'pending', 'paid'].includes(r.status))) return { data: null, error: { code: '23505' } };
        rows.push(payload); data = [payload];
      }
      if (op === 'update') data.forEach(r => Object.assign(r, payload));
      if (op === 'upsert') { if (!rows.some(r => r.idempotency_key === payload.idempotency_key)) rows.push(payload); data = [payload]; }
      return { data, error: null };
    };
    const q: any = { select: () => q, order: () => q, limit: () => q,
      eq: (key: string, value: any) => { filters.push(r => r[key] === value); return q; },
      in: (key: string, values: any[]) => { filters.push(r => values.includes(r[key])); return q; },
      insert: (p: any) => { payload = p; op = 'insert'; return q; }, update: (p: any) => { payload = p; op = 'update'; return q; },
      upsert: (p: any) => { payload = p; op = 'upsert'; return q; },
      maybeSingle: async () => { const r = run(); return { ...r, data: r.data?.[0] ?? null }; },
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    }; return q;
  }
  async rpc(name: string, args: any) {
    assert.equal(name, 'appypay_confirm_service_payment'); assert.equal(args.p_charge_id, chargeId);
    assert.equal(this.tables.payment_provider_events.length, 1); this.confirmations++;
    return { data: { status: 'reconciled' }, error: null };
  }
}
const db = (memory: Memory) => memory as any;
test('portal broker rejects stale, malformed, modified and unsigned commands', () => {
  const body = JSON.stringify(command()), now = Date.now(), time = String(now);
  const signature = brokerSignature(body, time, config.clientSecret);
  assert.equal(verifyBroker(body, time, signature, config.clientSecret, now), true);
  assert.equal(verifyBroker(body + ' ', time, signature, config.clientSecret, now), false);
  assert.equal(verifyBroker(body, time, signature, config.clientSecret, now + 60001), false);
  assert.equal(verifyBroker(body, time, 'x', config.clientSecret, now), false);
  assert.equal(verifyBroker(body, time, signature, 'other', now), false);
});
test('broker transport uses only the fixed application host and a signed scope; never provider credentials or cookies', async () => {
  await callPortalBroker(command(), config, (async (url: any, init: any) => {
    assert.equal(url, 'https://app.klasse.ao/api/jobs/appypay/portal'); assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store'); assert.ok(!JSON.stringify(init).includes(config.clientSecret));
    assert.equal(init.headers.Cookie, undefined);
    assert.equal(verifyBroker(init.body, init.headers['x-appypay-time'], init.headers['x-appypay-signature'], config.clientSecret), true);
    return Response.json({ ok: true, amount: 1500 });
  }) as typeof fetch);
});
test('streamed student payload is bounded without Content-Length', async () => {
  await assert.rejects(boundedBody(new Request('https://fixture.invalid', { method: 'POST', body: 'x'.repeat(4097) })), /demasiado/);
});
test('service preview is read-only and filters both school and student', async () => {
  const memory = new Memory();
  const result = await portalOperation(db(memory), {} as any, command(), 'provider1');
  assert.equal(result.amount, 1500); assert.equal(result.canIssue, true); assert.equal(memory.tables.appypay_service_references.length, 0);
  await assert.rejects(portalOperation(db(memory), {} as any, { ...command(), studentId: 'other' }, 'provider1'), /não encontrado/);
  await assert.rejects(portalOperation(db(memory), {} as any, { ...command(), schoolId: 'other' }, 'provider1'), /não encontrado/);
});
test('changed service tariff, pending proof and another student cannot issue a charge', async () => {
  const memory = new Memory(); let calls = 0; const client = { createReference: async () => { calls++; } } as any;
  await assert.rejects(portalOperation(db(memory), client, { ...command('issue'), expectedAmount: 1000 }, 'provider1'), /saldo/);
  memory.tables.pagamento_intents[0].evidence_url = 'private-proof';
  await assert.rejects(portalOperation(db(memory), client, command('issue'), 'provider1'), /indisponível/);
  memory.tables.pagamento_intents[0].evidence_url = null; memory.tables.servico_pedidos[0].valor_cobrado = 2000;
  await assert.rejects(portalOperation(db(memory), client, command('issue'), 'provider1'), /indisponível/);
  assert.equal(calls, 0); assert.equal(memory.tables.appypay_service_references.length, 0);
});
test('service issue reserves once, reuses an active reference and never repeats an uncertain POST', async () => {
  const memory = new Memory(); let calls = 0;
  const client = { createReference: async (input: any) => { calls++; return { id: chargeId, responseStatus: { successful: true, status: 'Pending', code: 101, source: 'REF',
      reference: { entity: '00123', referenceNumber: input.reference, dueDate: input.expiresAt } } }; } } as any;
  const first = await portalOperation(db(memory), client, command('issue'), 'provider1');
  const second = await portalOperation(db(memory), client, command('issue'), 'provider1');
  assert.equal(first.reference?.id, second.reference?.id); assert.equal(calls, 1);
  assert.equal(memory.tables.appypay_service_references[0].intent_id, 'intent1');
  memory.tables.appypay_service_references[0].status = 'pending';
  await assert.rejects(portalOperation(db(memory), client, command('issue'), 'provider1'), /processamento/); assert.equal(calls, 1);
});
test('monthly student preview computes outstanding balance and prevents payment with proof pending', async () => {
  const memory = new Memory(); const c = { ...command(), kind: 'monthly' as const, targetId: 'monthly1' };
  assert.equal((await portalOperation(db(memory), {} as any, c, 'provider1')).amount, 1000);
  memory.tables.pagamentos.push({ id: 'proof', escola_id: school, mensalidade_id: 'monthly1', status: 'pending' });
  assert.equal((await portalOperation(db(memory), {} as any, c, 'provider1')).canIssue, false);
  await assert.rejects(portalOperation(db(memory), {} as any, { ...c, action: 'issue', expectedAmount: 1000 }, 'provider1'), /indisponível/);
});
test('service reconciliation verifies charge before creating the event and invoking machine-only atomic SQL', async () => {
  const memory = new Memory(), ref = { ...newReference(school, 'provider1', 'order1', 1500), kind: 'service' as const, provider_reference_id: chargeId };
  const charge = { id: chargeId, merchantTransactionId: ref.provider_payload.merchant_id, amount: 1500, currency: 'AOA', responseStatus: { successful: true, status: 'Success', code: 100, source: 'REF' } };
  await assert.rejects(reconcileCharge(db(memory), { getCharge: async () => ({ ...charge, amount: 1 }) } as any, ref), /não corresponde/);
  assert.equal(memory.confirmations, 0); assert.equal(memory.tables.payment_provider_events.length, 0);
  assert.equal((await reconcileCharge(db(memory), { getCharge: async () => charge } as any, ref)).status, 'reconciled');
  assert.equal(memory.confirmations, 1);
});
test('repeated service orders keep distinct order identities and expose only draft intents for payment', () => {
  const orders = extractServicosFromPedidos([{ id: 'order1', servico_nome: 'Certificado', servico_codigo: 'DOC_CERT', status: 'pending_payment', valor_cobrado: 1500,
    pagamento_intents: [{ id: 'intent1', status: 'draft' }] }, { id: 'order2', servico_nome: 'Certificado', status: 'pending_payment', valor_cobrado: 1500 }]);
  assert.equal(orders[0].appypay_intent_id, 'intent1'); assert.equal(orders[1].pedido_id, 'order2');
  const paid = extractServicosFromPagamentos([{ id: 'payment', status: 'settled', meta: { servico_pedido_id: 'old-order', itens_pagamento: [{ tipo: 'servico', nome: 'Certificado', preco: 1500 }] } }]);
  assert.equal(paid[0].pedido_id, 'old-order'); assert.notEqual(paid[0].pedido_id, orders[0].pedido_id);
});

test('simultaneous service issuers elect one creator and a timeout is never posted twice', async () => {
  const memory = new Memory(); let posts = 0;
  const client = { createReference: async () => { posts++; throw new Error('transport timeout'); } } as any;
  const results = await Promise.allSettled([
    portalOperation(db(memory), client, command('issue'), 'provider1'),
    portalOperation(db(memory), client, command('issue'), 'provider1'),
  ]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(posts, 1); assert.equal(memory.tables.appypay_service_references.length, 1);
  await assert.rejects(portalOperation(db(memory), client, command('issue'), 'provider1'), /processamento/);
  assert.equal(posts, 1);
});
