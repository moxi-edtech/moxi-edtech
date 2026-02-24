import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PagamentoRow = {
  mensalidade_id?: string | null
  escola_id?: string | null
  valor_pago?: number | null
}

type MensalidadeRow = {
  escola_id?: string | null
  valor_previsto?: number | null
  valor?: number | null
}

const supabaseAdmin = (() => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    console.warn('[MCX Webhook Job] Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createAdminClient(url, key);
})();

function resolveJobToken(req: Request) {
  return req.headers.get('x-job-token') || req.headers.get('authorization')?.replace('Bearer ', '');
}

export async function POST(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.MCX_WEBHOOK_JOB_TOKEN || process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idempotencyKey =
    req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header é obrigatório' },
      { status: 400 }
    );
  }

  try {
    const raw = await req.text();
    const secret = (process.env.MCX_WEBHOOK_SECRET || '').trim();
    const signature =
      req.headers.get('x-mcx-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-webhook-signature') ||
      '';

    if (secret) {
      if (!signature || !isValidSignature(raw, signature, secret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('[MCX Webhook Job] MCX_WEBHOOK_SECRET ausente — validação de assinatura desativada.');
    }

    const payload = safeJson(raw) as
      | { transactionId?: string; id?: string; status?: string; customReference?: string; referenceId?: string }
      | null;
    const transactionId = payload?.transactionId || payload?.id;
    const status = payload?.status;
    const customReference = payload?.customReference || payload?.referenceId;

    if (!transactionId || !status) {
      return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
    }

    console.log(`🔔 MCX Webhook: tx=${transactionId} status=${status} ref=${customReference ?? '-'} `);

    const norm = String(status).toLowerCase();

    if (norm === 'success' || norm === 'paid' || norm === 'concluido') {
      const { data: pagamento, error: pagamentoErr } = await supabaseAdmin
        .from('pagamentos')
        .select('id, mensalidade_id, valor_pago, escola_id')
        .eq('transacao_id_externo', transactionId)
        .maybeSingle();

      if (pagamentoErr) {
        console.error('[MCX Webhook Job] Erro ao carregar pagamento:', pagamentoErr.message);
      }

      const pagamentoRow = pagamento as PagamentoRow | null
      const mensalidadeId = pagamentoRow?.mensalidade_id || customReference;
      if (!mensalidadeId) {
        return NextResponse.json({ received: true, error: 'Mensalidade não encontrada' }, { status: 200 });
      }

      const { data: mensalidade, error: menErr } = await supabaseAdmin
        .from('mensalidades')
        .select('id, escola_id, valor_previsto, valor')
        .eq('id', mensalidadeId)
        .maybeSingle();

      if (menErr || !mensalidade) {
        return NextResponse.json({ received: true, error: 'Mensalidade inválida' }, { status: 200 });
      }

      const mensalidadeRow = mensalidade as MensalidadeRow | null;
      const escolaId = pagamentoRow?.escola_id || mensalidadeRow?.escola_id;
      const amount = Number(pagamentoRow?.valor_pago ?? mensalidadeRow?.valor_previsto ?? mensalidadeRow?.valor ?? 0);

      if (!escolaId || !amount) {
        return NextResponse.json({ received: true, error: 'Dados insuficientes para confirmar' }, { status: 200 });
      }

      const { data: existingIdempotency } = await supabaseAdmin
        .from('idempotency_keys')
        .select('result')
        .eq('escola_id', escolaId)
        .eq('scope', 'financeiro_mcx_webhook')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (existingIdempotency?.result) {
        return NextResponse.json(existingIdempotency.result, { status: 200 });
      }

      const dedupeKey = `mcx:${transactionId}`;
      const intentPayload = {
        escola_id: escolaId,
        aluno_id: null,
        mensalidade_id: mensalidadeId,
        amount,
        currency: 'AOA',
        method: 'mcx_express',
        external_ref: transactionId,
        status: 'pending',
        dedupe_key: dedupeKey,
      };

      const { data: intentUpsert, error: intentErr } = await supabaseAdmin
        .from('finance_payment_intents')
        .upsert(intentPayload, { onConflict: 'escola_id,dedupe_key' })
        .select()
        .maybeSingle();

      if (intentErr) {
        console.error('[MCX Webhook Job] Erro ao criar intent:', intentErr.message);
        return NextResponse.json({ received: true, error: intentErr.message }, { status: 200 });
      }

      const intent = intentUpsert
        ? intentUpsert
        : await supabaseAdmin
            .from('finance_payment_intents')
            .select('*')
            .eq('escola_id', escolaId)
            .eq('dedupe_key', dedupeKey)
            .maybeSingle()
            .then((res) => res.data);

      if (!intent) {
        return NextResponse.json({ received: true, error: 'Intent não encontrada' }, { status: 200 });
      }

      const { error: confirmErr } = await supabaseAdmin.rpc('finance_confirm_payment', {
        p_intent_id: intent.id,
      });

      if (confirmErr) {
        console.error('[MCX Webhook Job] Erro ao confirmar pagamento:', confirmErr.message);
        return NextResponse.json({ received: true, error: confirmErr.message }, { status: 200 });
      }

      const responsePayload = { received: true };
      await supabaseAdmin
        .from('idempotency_keys')
        .upsert(
          {
            escola_id: escolaId,
            scope: 'financeiro_mcx_webhook',
            key: idempotencyKey,
            result: responsePayload,
          },
          { onConflict: 'escola_id,scope,key' }
        );

      return NextResponse.json(responsePayload);
    }

    if (norm === 'failed' || norm === 'falhado' || norm === 'canceled' || norm === 'cancelled') {
      let failureEscolaId: string | null = null;
      const { data: pagamento } = await supabaseAdmin
        .from('pagamentos')
        .select('mensalidade_id, escola_id, valor_pago')
        .eq('transacao_id_externo', transactionId)
        .maybeSingle();

      const pagamentoRow = pagamento as PagamentoRow | null
      const mensalidadeId = pagamentoRow?.mensalidade_id || customReference;
      if (mensalidadeId) {
        const { data: mensalidade } = await supabaseAdmin
          .from('mensalidades')
          .select('id, escola_id, valor_previsto, valor')
          .eq('id', mensalidadeId)
          .maybeSingle();

        const mensalidadeRow = mensalidade as MensalidadeRow | null
        const escolaId = pagamentoRow?.escola_id || mensalidadeRow?.escola_id;
        failureEscolaId = escolaId ?? null;
        if (escolaId) {
          const { data: existingIdempotency } = await supabaseAdmin
            .from('idempotency_keys')
            .select('result')
            .eq('escola_id', escolaId)
            .eq('scope', 'financeiro_mcx_webhook')
            .eq('key', idempotencyKey)
            .maybeSingle();

          if (existingIdempotency?.result) {
            return NextResponse.json(existingIdempotency.result, { status: 200 });
          }

          const dedupeKey = `mcx:${transactionId}`;
          const { data: existing } = await supabaseAdmin
            .from('finance_payment_intents')
            .select('id, status')
            .eq('escola_id', escolaId)
            .eq('dedupe_key', dedupeKey)
            .maybeSingle();

          if (!existing) {
            const amount = Number(
              pagamentoRow?.valor_pago ??
                mensalidadeRow?.valor_previsto ??
                mensalidadeRow?.valor ??
                0
            );
            await supabaseAdmin.from('finance_payment_intents').insert({
              escola_id: escolaId,
              mensalidade_id: mensalidadeId,
              amount,
              currency: 'AOA',
              method: 'mcx_express',
              external_ref: transactionId,
              status: 'rejected',
              dedupe_key: dedupeKey,
            });
          } else if (existing.status === 'pending') {
            await supabaseAdmin
              .from('finance_payment_intents')
              .update({ status: 'rejected' })
              .eq('id', existing.id);
          }
        }
      }

      const { error } = await supabaseAdmin
        .from('pagamentos')
        .update({ status: 'falhado' })
        .eq('transacao_id_externo', transactionId);

      if (error) {
        console.error('[MCX Webhook Job] Update failed pagamento error:', error.message);
      }

      if (failureEscolaId) {
        await supabaseAdmin
          .from('idempotency_keys')
          .upsert(
            {
              escola_id: failureEscolaId,
              scope: 'financeiro_mcx_webhook',
              key: idempotencyKey,
              result: { received: true },
            },
            { onConflict: 'escola_id,scope,key' }
          );
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook Error:', message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  } catch {
    return {};
  }
}

function isValidSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    let sig = signatureHeader.trim();
    if (sig.includes('v1=')) {
      const parts = sig.split(',').map((s) => s.trim());
      const v1 = parts.find((p) => p.startsWith('v1='));
      if (v1) sig = v1.slice(3);
    }
    if (sig.startsWith('sha256=')) sig = sig.slice(7);

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody, 'utf8');
    const expected = hmac.digest('hex');
    return constantTimeEqual(expected, sig);
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
