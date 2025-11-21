import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Webhook de confirmação do Gateway MCX.
// Usa service_role para ignorar RLS e atualizar pagamentos sem sessão de usuário.
const supabaseAdmin = (() => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    console.warn('[MCX Webhook] Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createAdminClient(url, key);
})();

export async function POST(req: Request) {
  try {
    // 1) Validar assinatura do Gateway (se configurado)
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
      console.warn('[MCX Webhook] MCX_WEBHOOK_SECRET ausente — validação de assinatura desativada.');
    }

    const payload = safeJson(raw);
    // Campos dependem do provedor; padronizamos os comuns
    const transactionId: string | undefined = payload?.transactionId || payload?.id;
    const status: string | undefined = payload?.status;
    const customReference: string | undefined = payload?.customReference || payload?.referenceId;

    if (!transactionId || !status) {
      return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
    }

    console.log(`🔔 MCX Webhook: tx=${transactionId} status=${status} ref=${customReference ?? '-'} `);

    // Normaliza status
    const norm = String(status).toLowerCase();

    if (norm === 'success' || norm === 'paid' || norm === 'concluido') {
      const { data: pagamento, error } = await supabaseAdmin
        .from('pagamentos')
        .update({
          status: 'concluido',
          conciliado: true,
          data_pagamento: new Date().toISOString(),
        })
        .eq('transacao_id_externo', transactionId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[MCX Webhook] Update pagamento error:', error.message);
        // Retorna 200 para evitar retries infinitos se o provedor não tolera 5xx, mas loga o erro
        return NextResponse.json({ received: true, error: error.message }, { status: 200 });
      }

      // 3) Se existir mensalidade associada, verificar se já está totalmente paga
      const mensalidadeId = (pagamento as any)?.mensalidade_id;
      if (mensalidadeId) {
        const { data: mensalidade, error: menErr } = await supabaseAdmin
          .from('mensalidades')
          .select('id, valor, status')
          .eq('id', mensalidadeId)
          .maybeSingle();

        if (menErr) {
          console.error('[MCX Webhook] Erro ao carregar mensalidade:', menErr.message);
        } else if (mensalidade) {
          const { data: pagos, error: pagosErr } = await supabaseAdmin
            .from('pagamentos')
            .select('valor_pago')
            .eq('mensalidade_id', mensalidadeId)
            .eq('conciliado', true);

          if (pagosErr) {
            console.error('[MCX Webhook] Erro ao somar pagamentos:', pagosErr.message);
          } else {
            const sumPago = (pagos || []).reduce((acc: number, p: any) => acc + Number(p.valor_pago || 0), 0);
            const esperado = Number((mensalidade as any).valor || 0);
            const epsilon = 0.005; // tolerância de centavos
            if (sumPago + epsilon >= esperado && (mensalidade as any).status !== 'pago') {
              const { error: upMenErr } = await supabaseAdmin
                .from('mensalidades')
                .update({ status: 'pago', pago_em: new Date().toISOString() })
                .eq('id', mensalidadeId);
              if (upMenErr) {
                console.error('[MCX Webhook] Erro ao fechar mensalidade:', upMenErr.message);
              }
            }
          }
        }
      }

      return NextResponse.json({ received: true });
    }

    if (norm === 'failed' || norm === 'falhado' || norm === 'canceled' || norm === 'cancelled') {
      const { error } = await supabaseAdmin
        .from('pagamentos')
        .update({ status: 'falhado' })
        .eq('transacao_id_externo', transactionId);

      if (error) {
        console.error('[MCX Webhook] Update failed pagamento error:', error.message);
      }
      return NextResponse.json({ received: true });
    }

    // Outros status (pendente, in_progress, etc.) — acknowledge sem mudanças
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook Error:', message);
    // Alguns provedores fazem retry em 5xx; se preferir evitar, responda 200 com erro
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isValidSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    // Suporta formatos: "sha256=abcdef", "abcdef", ou "t=...,v1=abcdef"
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
