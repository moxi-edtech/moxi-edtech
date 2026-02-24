import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { PaymentGatewayService } from '@/lib/financeiro/services/payment-gateway';

export async function POST(req: Request) {
  const supabase = (await supabaseServer()) as any;

  try {
    const idempotencyKey =
      req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key');
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
      .select('valor_previsto, escola_id, aluno:alunos(nome)')
      .eq('id', mensalidadeId)
      .single();

    if (errMen || !mensalidade) {
      return NextResponse.json({ error: 'Mensalidade não encontrada' }, { status: 404 });
    }

    const escolaId = (mensalidade as { escola_id?: string | null }).escola_id ?? null;
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 400 });
    }

    const { data: existingIdempotency } = await supabase
      .from('idempotency_keys')
      .select('result')
      .eq('escola_id', escolaId)
      .eq('scope', 'financeiro_pagamentos_mcx')
      .eq('key', idempotencyKey)
      .maybeSingle();

    if (existingIdempotency?.result) {
      return NextResponse.json(existingIdempotency.result, { status: 200 });
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
      return NextResponse.json({ error: pgResponse.message ?? 'Falha no gateway' }, { status: 502 });
    }

    // 3) Registar tentativa de pagamento (pendente até webhook)
    const { error: errPag } = await supabase.from('pagamentos').insert({
      mensalidade_id: mensalidadeId,
      valor_pago: Number((mensalidade as any).valor_previsto),
      metodo_pagamento: 'mcx_express',
      telemovel_origem: String(telemovel),
      transacao_id_externo: pgResponse.transactionId,
      status: 'pendente',
      conciliado: false,
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
      .upsert(
        {
          escola_id: escolaId,
          scope: 'financeiro_pagamentos_mcx',
          key: idempotencyKey,
          result: responsePayload,
        },
        { onConflict: 'escola_id,scope,key' }
      );

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
