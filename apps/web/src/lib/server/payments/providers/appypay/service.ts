import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppyPayClient, PaymentError, newReference, publicReference, sameAmount, verifiedCharge, type Reference } from './core';

function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new PaymentError(503, 'Não foi possível persistir a operação');
  return result.data;
}
export async function issueReference(db: SupabaseClient, client: AppyPayClient, schoolId: string, providerId: string, obligationId: string, expectedAmount?: number) {
  const obligation = checked(await db.from('mensalidades').select('id,valor,valor_previsto,valor_pago_total,status')
    .eq('id', obligationId).eq('escola_id', schoolId).maybeSingle());
  if (!obligation) throw new PaymentError(404, 'Mensalidade não encontrada');
  const amount = Math.round((Number(obligation.valor_previsto ?? obligation.valor) - Number(obligation.valor_pago_total ?? 0)) * 100) / 100;
  if (!(amount > 0) || ['pago', 'isento', 'cancelado'].includes(obligation.status)) throw new PaymentError(409, 'Mensalidade sem saldo pendente');
  if (expectedAmount !== undefined && !sameAmount(amount, expectedAmount)) throw new PaymentError(409, 'O saldo foi alterado. Consulte a mensalidade antes de emitir.');
  const existing = checked(await db.from('payment_references').select('*').eq('school_id', schoolId).eq('obligation_id', obligationId)
    .in('status', ['pending', 'active']).maybeSingle()) as Reference | null;
  if (existing) {
    if (existing.provider_id !== providerId || existing.status === 'pending') throw new PaymentError(409, 'Referência em processamento; aguarde reconciliação');
    if (Date.parse(existing.expires_at) <= Date.now() || !sameAmount(existing.amount, amount)) throw new PaymentError(409, 'Referência requer revisão antes de nova emissão');
    return publicReference(existing);
  }
  const reserved = newReference(schoolId, providerId, obligationId, amount);
  // Reserve before calling AppyPay. The unique active-obligation index elects one creator.
  const reservation = await db.from('payment_references').insert(reserved);
  if (reservation.error) throw new PaymentError(409, 'Já existe uma emissão em curso; atualize a consulta');
  // Unknown outcomes remain pending. Never retry a financial POST automatically.
  const charge = await client.createReference({ amount, merchantId: reserved.provider_payload.merchant_id!, reference: reserved.reference, expiresAt: reserved.expires_at });
  const detail = charge.responseStatus.reference ?? charge.reference;
  if (!charge.responseStatus.successful || ![100, 101].includes(charge.responseStatus.code) || !detail?.entity ||
      detail.referenceNumber !== reserved.reference || !Number.isFinite(Date.parse(detail.dueDate))) throw new PaymentError(502, 'Emissão requer verificação no provedor');
  const saved = checked(await db.from('payment_references').update({ provider_reference_id: charge.id, entity: detail.entity,
    expires_at: detail.dueDate, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', reserved.id).eq('school_id', schoolId).eq('provider_id', providerId).eq('status', 'pending').select('*').maybeSingle()) as Reference | null;
  // An early callback may already have linked and paid this reservation. Never downgrade it.
  const current = saved ?? checked(await db.from('payment_references').select('*').eq('id', reserved.id)
    .eq('school_id', schoolId).eq('provider_id', providerId).eq('provider_reference_id', charge.id).maybeSingle()) as Reference | null;
  if (!current) throw new PaymentError(503, 'Emissão requer verificação no provedor');
  return publicReference(current);
}


export async function recoverPendingReference(db: SupabaseClient, client: AppyPayClient, schoolId: string, providerId: string, chargeId: string, merchantId: unknown, kind: 'monthly' | 'service' = 'monthly'): Promise<Reference | null> {
  if (typeof merchantId !== 'string' || !/^[a-z0-9]{15}$/i.test(merchantId)) return null;
  const candidate = checked(await db.from(kind === 'service' ? 'appypay_service_references' : 'payment_references').select('*').eq('school_id', schoolId).eq('provider_id', providerId)
    .eq('status', 'pending').eq('provider_payload->>merchant_id', merchantId).maybeSingle()) as Reference | null;
  if (!candidate) return null;
  const charge = await client.getCharge(chargeId);
  verifiedCharge(charge, { ...candidate, provider_reference_id: chargeId });
  const detail = charge.reference ?? charge.responseStatus.reference;
  if (!detail?.entity || detail.referenceNumber !== candidate.reference || !Number.isFinite(Date.parse(detail.dueDate))) throw new PaymentError(409, 'Referência do provedor incompatível');
  const saved = checked(await db.from(kind === 'service' ? 'appypay_service_references' : 'payment_references').update({ provider_reference_id: chargeId, entity: detail.entity,
    expires_at: detail.dueDate, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', candidate.id).eq('school_id', schoolId).eq('provider_id', providerId).eq('status', 'pending').select('*').maybeSingle()) as Reference | null;
  const current = saved ?? checked(await db.from(kind === 'service' ? 'appypay_service_references' : 'payment_references').select('*').eq('id', candidate.id)
    .eq('school_id', schoolId).eq('provider_id', providerId).eq('provider_reference_id', chargeId).maybeSingle()) as Reference | null;
  return current ? { ...current, kind } : null;
}

export async function reconcileCharge(db: SupabaseClient, client: AppyPayClient, reference: Reference) {
  const charge = await client.getCharge(reference.provider_reference_id);
  const state = verifiedCharge(charge, reference);
  if (state !== 'paid') return { status: state };
  const dedupe = `appypay:${charge.id}`;
  // Persist only the verified minimal response; the callback body is untrusted.
  checked(await db.from('payment_provider_events').upsert({ provider_id: reference.provider_id, school_id: reference.school_id,
    provider_event_id: charge.id, event_type: 'payment', idempotency_key: dedupe, payload_hash: createHash('sha256').update(JSON.stringify(charge)).digest('hex'),
    payload: { id: charge.id, amount: charge.amount, merchantTransactionId: charge.merchantTransactionId, responseStatus: charge.responseStatus },
    status: 'pending' }, { onConflict: 'provider_id,idempotency_key', ignoreDuplicates: true }));
  if (reference.kind === 'service') {
    const result = checked(await db.rpc('appypay_confirm_service_payment', { p_reference_id: reference.id, p_charge_id: charge.id }));
    return result as { status: string };
  }
  const eventQuery = () => db.from('payment_provider_events').update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null })
    .eq('provider_id', reference.provider_id).eq('school_id', reference.school_id).eq('idempotency_key', dedupe);
  // ignoreDuplicates is essential: upsert(update) could reset an already confirmed intent.
  checked(await db.from('finance_payment_intents').upsert({ escola_id: reference.school_id, mensalidade_id: reference.obligation_id,
    amount: reference.amount, currency: 'AOA', method: 'referencia', external_ref: charge.id, status: 'pending', dedupe_key: dedupe },
    { onConflict: 'escola_id,dedupe_key', ignoreDuplicates: true }));
  const intent = checked(await db.from('finance_payment_intents').select('id,status,amount,mensalidade_id')
    .eq('escola_id', reference.school_id).eq('dedupe_key', dedupe).single());
  if (!intent || !sameAmount(intent.amount, reference.amount) || intent.mensalidade_id !== reference.obligation_id) throw new PaymentError(409, 'Intent incompatível');
  if (intent.status !== 'confirmed') {
    const obligation = checked(await db.from('mensalidades').select('id,valor,valor_previsto,valor_pago_total,status')
      .eq('id', reference.obligation_id).eq('escola_id', reference.school_id).maybeSingle());
    const outstanding = obligation ? Number(obligation.valor_previsto ?? obligation.valor) - Number(obligation.valor_pago_total ?? 0) : 0;
    if (!obligation || !sameAmount(outstanding, reference.amount) || ['pago', 'isento', 'cancelado'].includes(obligation.status)) {
      checked(await db.from('payment_provider_events').update({ status: 'manual_review', error_message: 'Saldo divergente; não baixar automaticamente' })
        .eq('provider_id', reference.provider_id).eq('school_id', reference.school_id).eq('idempotency_key', dedupe));
      return { status: 'manual_review' };
    }
    // This wrapper must be approved/applied before activation. It rechecks balance
    // under the same row locks as confirmation, including concurrent manual payments.
    const confirmation = await db.rpc('appypay_confirm_payment', { p_intent_id: intent.id });
    if (confirmation.error?.message?.includes('APPYPAY_BALANCE_CHANGED')) {
      checked(await db.from('payment_provider_events').update({ status: 'manual_review', error_message: 'Saldo alterado durante a confirmação' })
        .eq('provider_id', reference.provider_id).eq('school_id', reference.school_id).eq('idempotency_key', dedupe));
      return { status: 'manual_review' };
    }
    checked(confirmation);
  }
  checked(await db.from('payment_provider_transactions').upsert({ school_id: reference.school_id, provider_id: reference.provider_id,
    payment_reference_id: reference.id, obligation_id: reference.obligation_id, provider_transaction_id: charge.id,
    amount: reference.amount, currency: 'AOA', status: 'reconciled', raw_metadata: { id: charge.id } },
    { onConflict: 'provider_id,provider_transaction_id', ignoreDuplicates: true }));
  checked(await db.from('payment_references').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', reference.id).eq('school_id', reference.school_id).eq('provider_id', reference.provider_id).neq('status', 'paid'));
  checked(await eventQuery());
  return { status: 'reconciled' };
}
