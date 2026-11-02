import { AppyPayClient, PaymentError, newReference, verifiedCharge, type AppyPayConfig } from './core';
import { sessionFromToken, type FlowConfig, type FlowRequest } from './whatsapp-crypto';
import type { TestSession, TestStore } from './whatsapp-store';

type Client = Pick<AppyPayClient, 'createReference' | 'getCharge' | 'simulateReference'>;
const start = { version: '3.0', screen: 'START', data: {} };
function view(row: TestSession) {
  if (row.state === 'paid') return { version: '3.0', screen: 'STATUS', data: { status: 'Pagamento simulado confirmado. Nenhuma propina real foi alterada.' } };
  const r = row.reference_payload;
  if (!r || !['issued', 'simulating'].includes(row.state)) throw new PaymentError(503, 'Emissão em verificação. Não emita novamente.');
  return { version: '3.0', screen: 'REFERENCE', data: { amount: '100,00 AOA (teste)', entity: r.entity, reference: r.reference,
    expires_at: r.expires_at, charge_id: r.provider_reference_id, status: row.state === 'simulating' ? 'Simulação em verificação. Pode consultar novamente.' : 'Referência de teste emitida.' } };
}
export async function handleTestFlow(payload: FlowRequest, config: FlowConfig, appy: AppyPayConfig, store: TestStore, client: Client) {
  if (appy.environment !== 'sandbox' || appy.schoolId !== config.schoolId) throw new PaymentError(403, 'Flow exclusivo de homologação');
  if (payload.action === 'ping') return { data: { status: 'active' } };
  const token = sessionFromToken(payload.flow_token, config);
  let row = await store.ensure({ id: token.id, school_id: config.schoolId, token_hash: token.tokenHash, flow_id: config.flowId, phone_id: config.phoneId,
    expires_at: token.expiresAt, state: 'ready', reference_payload: newReference(config.schoolId, 'sandbox-whatsapp', token.id, 100) });
  const ref = row.reference_payload;
  if (!ref || ref.amount !== 100 || ref.currency !== 'AOA' || ref.school_id !== config.schoolId || ref.obligation_id !== token.id) throw new PaymentError(409, 'Sessão incompatível');
  if (payload.data?.error) return { data: { acknowledged: true } };
  if (payload.action === 'INIT' || payload.action === 'BACK') return row.state === 'ready' ? start : view(row);
  if (payload.action !== 'data_exchange') throw new PaymentError(400, 'Ação inválida');
  if (payload.screen === 'START' && payload.data?.action === 'issue_test_reference') {
    if (row.state !== 'ready') return view(row);
    const reserved = await store.transition(row, 'ready', { state: 'issuing' });
    if (!reserved) return view(await store.current(row));
    const charge = await client.createReference({ amount: 100, merchantId: ref.provider_payload.merchant_id!, reference: ref.reference,
      expiresAt: ref.expires_at, description: 'KLASSE WhatsApp homologacao ficticia sem aluno' });
    const detail = charge.reference ?? charge.responseStatus.reference;
    if (!charge.responseStatus.successful || ![100, 101].includes(charge.responseStatus.code) || !/^[a-f0-9-]{36}$/i.test(charge.id) ||
      !detail?.entity || detail.referenceNumber !== ref.reference || !Number.isFinite(Date.parse(detail.dueDate))) throw new PaymentError(502, 'Emissão requer verificação');
    row = await store.transition(row, 'issuing', { state: 'issued', reference_payload: { ...ref, provider_reference_id: charge.id,
      entity: detail.entity, expires_at: detail.dueDate, status: 'active' } }) ?? await store.current(row);
    return view(row);
  }
  if (payload.screen === 'REFERENCE' && payload.data?.action === 'simulate_test_payment') {
    if (row.state === 'paid') return view(row);
    if (!['issued', 'simulating'].includes(row.state)) throw new PaymentError(409, 'Emita a referência de teste primeiro');
    if (row.state === 'issued') {
      const reservation = await store.transition(row, 'issued', { state: 'simulating' });
      if (reservation) await client.simulateReference(ref.entity, ref.reference);
      // Unknown outcomes stay simulating. Later requests only perform GET.
    }
    const charge = await client.getCharge(ref.provider_reference_id);
    const status = verifiedCharge(charge, ref);
    if (status === 'paid') row = await store.transition(row, 'simulating', { state: 'paid' }) ?? await store.current(row);
    else row = await store.current(row);
    return view(row);
  }
  throw new PaymentError(400, 'Ação inválida');
}
