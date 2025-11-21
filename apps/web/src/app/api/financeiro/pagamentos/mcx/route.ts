import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { PaymentGatewayService } from '@/lib/financeiro/services/payment-gateway';

export async function POST(req: Request) {
  const supabase = (await supabaseServer()) as any;

  try {
    const body = await req.json().catch(() => ({}));
    const { mensalidadeId, telemovel } = body ?? {};

    if (!mensalidadeId || !telemovel) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1) Buscar dados da mensalidade
    const { data: mensalidade, error: errMen } = await supabase
      .from('mensalidades')
      .select('valor_previsto, aluno:alunos(nome)')
      .eq('id', mensalidadeId)
      .single();

    if (errMen || !mensalidade) {
      return NextResponse.json({ error: 'Mensalidade não encontrada' }, { status: 404 });
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

    return NextResponse.json({
      message: 'Notificação enviada para o telemóvel',
      transactionId: pgResponse.transactionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
