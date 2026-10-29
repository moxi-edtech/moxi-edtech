import type { SupabaseClient } from '@supabase/supabase-js';
import { AppyPayClient, PaymentError, newReference, publicReference, sameAmount, type Reference } from './core';
import { issueReference, reconcileCharge } from './service';
import type { PortalCommand } from './portal-broker';

function checked<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new PaymentError(503, 'Consulta de pagamento indisponível');
  return result.data;
}
export async function portalOperation(db: SupabaseClient, client: AppyPayClient, command: PortalCommand, providerId: string) {
  const { schoolId, studentId, targetId, kind } = command;
  const isService = kind === 'service';
  let obligationId: string, amount: number, eligible: boolean;
  if (isService) {
    const intent = checked(await db.from('pagamento_intents').select('id,servico_pedido_id,amount,currency,status,evidence_url')
      .eq('id', targetId).eq('escola_id', schoolId).eq('aluno_id', studentId).maybeSingle());
    if (!intent?.servico_pedido_id) throw new PaymentError(404, 'Serviço não encontrado');
    const order = checked(await db.from('servico_pedidos').select('id,valor_cobrado,status')
      .eq('id', intent.servico_pedido_id).eq('escola_id', schoolId).eq('aluno_id', studentId).maybeSingle());
    if (!order) throw new PaymentError(404, 'Serviço não encontrado');
    obligationId = order.id; amount = Number(intent.amount);
    eligible = intent.currency === 'AOA' && sameAmount(amount, order.valor_cobrado) &&
      intent.status === 'draft' && order.status === 'pending_payment' && !intent.evidence_url;
  } else {
    const obligation = checked(await db.from('mensalidades').select('id,valor,valor_previsto,valor_pago_total,status')
      .eq('id', targetId).eq('escola_id', schoolId).eq('aluno_id', studentId).maybeSingle());
    if (!obligation) throw new PaymentError(404, 'Propina não encontrada');
    obligationId = obligation.id;
    amount = Math.round((Number(obligation.valor_previsto ?? obligation.valor) - Number(obligation.valor_pago_total ?? 0)) * 100) / 100;
    const pending = checked(await db.from('pagamentos').select('id').eq('escola_id', schoolId)
      .eq('mensalidade_id', obligationId).eq('status', 'pending').limit(1));
    eligible = !['pago', 'isento', 'cancelado'].includes(obligation.status) && !pending?.length;
  }
  if (!Number.isFinite(amount)) throw new PaymentError(409, 'Valor inválido; contacte a tesouraria');
  const table = isService ? 'appypay_service_references' : 'payment_references';
  const row = checked(await db.from(table).select('*').eq('school_id', schoolId).eq('obligation_id', obligationId)
    .in('status', ['pending', 'active', 'paid']).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()) as Reference | null;
  const existing = row ? { ...row, kind } as Reference : null;
  const compatible = existing?.provider_id === providerId && (existing.status === 'paid' || sameAmount(existing.amount, amount));
  if (command.action === 'preview') return { amount, currency: 'AOA', canIssue: eligible && amount > 0 && !existing,
    reference: existing && compatible ? publicReference(existing) : null,
    message: existing && !compatible ? 'Esta referência precisa de conferência pela tesouraria.' : !eligible ? 'Este débito está pago, bloqueado ou possui um comprovativo em validação.' : null };
  if (command.action === 'check') {
    if (!existing || existing.id !== command.referenceId || existing.provider_id !== providerId || existing.status === 'pending') throw new PaymentError(409, 'Referência ainda em processamento; consulte o estado');
    return reconcileCharge(db, client, existing);
  }
  if (!sameAmount(amount, command.expectedAmount)) throw new PaymentError(409, 'O saldo foi alterado. Consulte o débito antes de emitir.');
  if (existing) {
    if (!compatible || existing.status !== 'active' || Date.parse(existing.expires_at) <= Date.now()) throw new PaymentError(409, 'Referência em processamento ou em revisão; consulte o estado');
    return { reference: publicReference(existing) };
  }
  if (!eligible || !(amount > 0)) throw new PaymentError(409, 'Débito indisponível para emissão');
  if (!isService) return { reference: await issueReference(db, client, schoolId, providerId, obligationId, command.expectedAmount) };
  const identity = newReference(schoolId, providerId, obligationId, amount);
  const reserved = { ...identity, intent_id: targetId,
    provider_payload: { ...identity.provider_payload, actor_id: command.actorId } };
  const insertion = await db.from(table).insert(reserved);
  if (insertion.error) throw new PaymentError(409, 'Já existe uma emissão em curso; consulte o estado');
  const charge = await client.createReference({ amount, merchantId: reserved.provider_payload.merchant_id!,
    reference: reserved.reference, expiresAt: reserved.expires_at, description: 'Servico KLASSE' });
  const detail = charge.reference ?? charge.responseStatus.reference;
  if (!charge.responseStatus.successful || charge.responseStatus.source !== 'REF' || ![100, 101].includes(charge.responseStatus.code) || !detail?.entity ||
      detail.referenceNumber !== reserved.reference || !Number.isFinite(Date.parse(detail.dueDate))) throw new PaymentError(502, 'Emissão requer conferência no provedor');
  const saved = checked(await db.from(table).update({ provider_reference_id: charge.id, entity: detail.entity, expires_at: detail.dueDate,
    status: 'active', updated_at: new Date().toISOString() }).eq('id', reserved.id).eq('school_id', schoolId).eq('provider_id', providerId)
    .eq('status', 'pending').select('*').maybeSingle()) as Reference | null;
  const current = saved ?? checked(await db.from(table).select('*').eq('id', reserved.id).eq('school_id', schoolId)
    .eq('provider_id', providerId).eq('provider_reference_id', charge.id).maybeSingle()) as Reference | null;
  if (!current) throw new PaymentError(503, 'Emissão requer conferência no provedor');
  return { reference: publicReference(current) };
}
