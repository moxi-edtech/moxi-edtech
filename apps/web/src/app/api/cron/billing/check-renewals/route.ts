import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendMail, buildBillingRenewalEmail } from '@/lib/mailer';
import { differenceInDays, parseISO } from 'date-fns';
import { PLAN_NAMES, type PlanTier } from '@/config/plans';

/**
 * Cron Job: Verifica renovações de subscrição e envia avisos por email.
 * Frequência sugerida: Diário às 08:00 WAT.
 * 
 * Autenticação: Protegido por CRON_SECRET para evitar chamadas externas.
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const s = await supabaseServer();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Buscar assinaturas activas
    const { data: assinaturas, error: assError } = await s
      .from('assinaturas')
      .select(`
        *,
        escolas:escola_id (
          id,
          nome,
          escola_users (
            id,
            role,
            papel_escola,
            email,
            nome
          )
        )
      `)
      .eq('status', 'activa');

    if (assError) throw assError;

    const resultados = {
      processados: 0,
      emailsEnviados: 0,
      erros: [] as string[]
    };

    for (const ass of (assinaturas || [])) {
      const dataRenovacao = parseISO(ass.data_renovacao);
      dataRenovacao.setHours(0, 0, 0, 0);
      
      const diasRestantes = differenceInDays(dataRenovacao, hoje);
      
      // Gatilhos de aviso: 30, 7 e 1 dia(s) antes
      if ([30, 7, 1].includes(diasRestantes)) {
        resultados.processados++;

        // Buscar o Director (admin_escola) para enviar o email
        const adminEscola = (ass.escolas as any)?.escola_users?.find((u: any) => 
          u.role === 'admin' || u.papel_escola === 'admin_escola'
        );

        const emailDestino = adminEscola?.email;
        if (!emailDestino) {
          resultados.erros.push(`Escola ${ass.escolas?.nome || ass.escola_id} sem admin configurado.`);
          continue;
        }

        const planoNome = PLAN_NAMES[ass.plano as PlanTier] || ass.plano;
        const valorFormatado = `Kz ${ass.valor_kz.toLocaleString()}`;
        const dataFormatada = dataRenovacao.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
        const referencia = `KLASSE-${ass.escola_id.slice(0, 4)}-${ass.id.slice(0, 4)}`.toUpperCase();
        
        const { subject, html, text } = await buildBillingRenewalEmail({
          escolaNome: (ass.escolas as any)?.nome || 'Director(a)',
          plano: planoNome,
          valor: valorFormatado,
          dataRenovacao: dataFormatada,
          diasRestantes,
          referencia,
          linkPagamento: `https://moxi-edtech.vercel.app/escola/${ass.escola_id}/admin/configuracoes/assinatura`
        });

        const res = await sendMail({
          to: emailDestino,
          subject,
          html,
          text
        });

        if (res.ok) resultados.emailsEnviados++;
        else resultados.erros.push(`Falha ao enviar para ${emailDestino}: ${res.error}`);
      }
    }

    return NextResponse.json({ ok: true, resultados });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
