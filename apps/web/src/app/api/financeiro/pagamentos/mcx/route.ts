import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { PaymentGatewayService } from '@/lib/financeiro/services/payment-gateway';
import { buildPaymentIdempotencyKey } from '@/lib/financeiro/paymentIdempotency';

export async function POST(req: Request) {
  const supabase = (await supabaseServer()) as any;

  try {
    const rawIdempotencyKey =
      req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key');
    const idempotencyKey = buildPaymentIdempotencyKey(
      'mcx-init',
      rawIdempotencyKey,
    );
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header é obrigatório' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { mensalidadeId, telemovel } = body ?? {};

    if (!mensalidadeId || !telemovel) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1) Buscar dados da mensalidade
    const { data: mensalidade, error: errMen } = await supabase
      .from('mensalidades')
      .select('valor_previsto, escola_id, aluno_id, aluno:alunos(nome)')
      .eq('id', mensalidadeId)
      .single();

    if (errMen || !mensalidade) {
      return NextResponse.json({ error: 'Mensalidade não encontrada' }, { status: 404 });
    }

    const escolaId = (mensalidade as { escola_id?: string | null }).escola_id ?? null;
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 400 });
    }

    const { error: claimError } = await supabase
      .from('idempotency_keys')
      .insert({
        escola_id: escolaId,
        scope: 'financeiro_pagamentos_mcx',
        key: idempotencyKey,
        result: null,
      });

    if (claimError) {
      if (claimError.code !== '23505') {
        return NextResponse.json(
          { error: 'Falha ao reservar identidade da operação' },
          { status: 500 },
        );
      }

      const { data: existingIdempotency } = await supabase
        .from('idempotency_keys')
        .select('result')
        .eq('escola_id', escolaId)
        .eq('scope', 'financeiro_pagamentos_mcx')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (existingIdempotency?.result) {
        const cached = existingIdempotency.result as Record<string, unknown>;
        const cachedStatus =
          typeof cached.http_status === 'number' ? cached.http_status : 200;
        const cachedBody = { ...cached };
        delete cachedBody.http_status;
        return NextResponse.json(cachedBody, { status: cachedStatus });
      }

      return NextResponse.json(
        {
          error: 'Operação com esta Idempotency-Key já está em processamento',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        },
        { status: 409 },
      );
    }

    // 2) Chamar o Gateway (MCX)
    const gateway = new PaymentGatewayService();
    const pgResponse = await gateway.initiateMCX({
      amount: Number((mensalidade as any).valor_previsto),
      mobileNumber: String(telemovel),
      referenceId: String(mensalidadeId),
      description: `Mensalidade ${mensalidade.aluno?.nome ?? ''}`.trim(),
    });

    if (!pgResponse.success) {
      const failurePayload = {
        error: pgResponse.message ?? 'Falha no gateway',
        code: 'MCX_PROVIDER_REJECTED',
        http_status: 502,
      };

      await supabase
        .from('idempotency_keys')
        .update({ result: failurePayload })
        .eq('escola_id', escolaId)
        .eq('scope', 'financeiro_pagamentos_mcx')
        .eq('key', idempotencyKey);

      return NextResponse.json(
        { error: failurePayload.error, code: failurePayload.code },
        { status: 502 },
      );
    }

    // 3) Registar tentativa de pagamento (pendente até webhook)
    const { error: errPag } = await supabase.from('pagamentos').insert({
      escola_id: escolaId,
      aluno_id: (mensalidade as { aluno_id?: string | null }).aluno_id ?? null,
      mensalidade_id: mensalidadeId,
      valor_pago: Number((mensalidade as any).valor_previsto),
      metodo_pagamento: 'mcx_express',
      telemovel_origem: String(telemovel),
      transacao_id_externo: pgResponse.transactionId,
      status: 'pendente',
      conciliado: false,
      idempotency_key: idempotencyKey,
      meta: {
        origem: 'mcx_init',
        idempotency_key: idempotencyKey,
        provider_transaction_id: pgResponse.transactionId,
      },
    });

    if (errPag) {
      console.error('Erro ao salvar pagamento:', errPag);
      return NextResponse.json({ error: 'Erro ao registar transação' }, { status: 500 });
    }

    const responsePayload = {
      message: 'Notificação enviada para o telemóvel',
      transactionId: pgResponse.transactionId,
    };

    await supabase
      .from('idempotency_keys')
      .update({ result: responsePayload })
      .eq('escola_id', escolaId)
      .eq('scope', 'financeiro_pagamentos_mcx')
      .eq('key', idempotencyKey);

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
