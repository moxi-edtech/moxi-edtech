import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { recordAuditServer } from '@/lib/audit';
import { sendMail, buildBillingRenewalEmail } from '@/lib/mailer';
import { PLAN_NAMES, type PlanTier } from '@/config/plans';

/**
 * API para Gestão Individual de Assinaturas (Cockpit Super Admin)
 */

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    if (!sess?.user || !(await checkIsAdmin(s, sess.user.id))) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { action, ...updates } = body;

    const { data: assBefore } = await s
      .from('assinaturas')
      .select('id, escola_id, status, ciclo, data_renovacao, notas_internas')
      .eq('id', id)
      .single();

    if (!assBefore) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada' }, { status: 404 });

    // 1. Acção Especial: Reenviar Instruções por Email
    if (action === 'resend_instructions') {
      const { data: ass } = await s
        .from('assinaturas')
        .select('*, escolas:escola_id(nome, escola_users(email, role, papel_escola))')
        .eq('id', id)
        .single();

      if (!ass) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada' }, { status: 404 });

      const admin = (ass.escolas as any)?.escola_users?.find((u: any) => u.role === 'admin' || u.papel_escola === 'admin_escola');
      if (!admin?.email) return NextResponse.json({ ok: false, error: 'Email do director não encontrado' }, { status: 400 });

      const { subject, html, text } = await buildBillingRenewalEmail({
        escolaNome: (ass.escolas as any)?.nome || 'Director(a)',
        plano: PLAN_NAMES[ass.plano as PlanTier] || ass.plano,
        valor: `Kz ${ass.valor_kz.toLocaleString()}`,
        dataRenovacao: new Date(ass.data_renovacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }),
        diasRestantes: 30, // Placeholder para instrução inicial
        referencia: `KLASSE-${ass.escola_id.slice(0, 4)}-${ass.id.slice(0, 4)}`.toUpperCase(),
        linkPagamento: `https://moxi-edtech.vercel.app/escola/${ass.escola_id}/admin/configuracoes/assinatura`
      });

      await sendMail({ to: admin.email, subject, html, text });
      
      await recordAuditServer({ 
        escolaId: ass.escola_id, 
        portal: 'super_admin', 
        acao: 'BILLING_INSTRUCTIONS_RESENT', 
        entity: 'assinaturas', 
        entityId: id 
      });

      return NextResponse.json({ ok: true, message: 'Instruções enviadas com sucesso' });
    }

    // 1.1 Acção Especial: Confirmar pagamento pendente
    if (action === 'confirm_payment') {
      const { data: latestPayment, error: latestPaymentError } = await s
        .from('pagamentos_saas')
        .select('id, status, created_at')
        .eq('assinatura_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPaymentError) throw latestPaymentError;
      if (!latestPayment) {
        return NextResponse.json({ ok: false, error: 'Pagamento não encontrado para esta assinatura' }, { status: 404 });
      }

      const novaDataRenovacao = new Date(assBefore.data_renovacao);
      if (assBefore.ciclo === 'mensal') novaDataRenovacao.setMonth(novaDataRenovacao.getMonth() + 1);
      else novaDataRenovacao.setFullYear(novaDataRenovacao.getFullYear() + 1);

      const { error: assError } = await s
        .from('assinaturas')
        .update({
          status: 'activa',
          data_renovacao: novaDataRenovacao.toISOString(),
        })
        .eq('id', id);

      if (assError) throw assError;

      const { error: paymentError } = await s
        .from('pagamentos_saas')
        .update({
          status: 'confirmado',
          confirmado_por: sess.user.id,
          confirmado_em: new Date().toISOString(),
        })
        .eq('id', latestPayment.id);

      if (paymentError) throw paymentError;

      await recordAuditServer({
        escolaId: assBefore.escola_id,
        portal: 'super_admin',
        acao: 'BILLING_PAYMENT_CONFIRMED',
        entity: 'assinaturas',
        entityId: id,
        details: {
          previous_status: assBefore.status,
          new_status: 'activa',
          payment_id: latestPayment.id,
          payment_previous_status: latestPayment.status,
          payment_new_status: 'confirmado',
        },
      });

      return NextResponse.json({ ok: true, message: 'Pagamento confirmado e assinatura activada' });
    }

    // 1.2 Acção Especial: Rejeitar pagamento pendente (motivo obrigatório)
    if (action === 'reject_payment') {
      const motivo = String(body.motivo ?? '').trim();
      if (!motivo) {
        return NextResponse.json({ ok: false, error: 'Motivo de rejeição é obrigatório' }, { status: 400 });
      }

      const { data: latestPayment, error: latestPaymentError } = await s
        .from('pagamentos_saas')
        .select('id, status, created_at')
        .eq('assinatura_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPaymentError) throw latestPaymentError;
      if (!latestPayment) {
        return NextResponse.json({ ok: false, error: 'Pagamento não encontrado para esta assinatura' }, { status: 404 });
      }

      const rejectedAt = new Date().toISOString();
      const notaRejeicao = `[${new Date(rejectedAt).toLocaleString('pt-PT')}] Rejeição de pagamento: ${motivo}`;
      const notasInternas = assBefore.notas_internas
        ? `${assBefore.notas_internas}\n${notaRejeicao}`
        : notaRejeicao;

      const { error: assError } = await s
        .from('assinaturas')
        .update({
          status: 'suspensa',
          notas_internas: notasInternas,
        })
        .eq('id', id);

      if (assError) throw assError;

      const { error: paymentError } = await s
        .from('pagamentos_saas')
        .update({
          status: 'falhado',
          confirmado_por: sess.user.id,
          confirmado_em: rejectedAt,
        })
        .eq('id', latestPayment.id);

      if (paymentError) throw paymentError;

      await recordAuditServer({
        escolaId: assBefore.escola_id,
        portal: 'super_admin',
        acao: 'BILLING_PAYMENT_REJECTED',
        entity: 'assinaturas',
        entityId: id,
        details: {
          motivo,
          previous_status: assBefore.status,
          new_status: 'suspensa',
          payment_id: latestPayment.id,
          payment_previous_status: latestPayment.status,
          payment_new_status: 'falhado',
        },
      });

      return NextResponse.json({ ok: true, message: 'Pagamento rejeitado' });
    }

    // 2. Actualizações Genéricas (Plano, Ciclo, Notas, Status)
    // Iniciar transação lógica (updates em paralelo ou sequência)
    const { error: errorAss } = await s
      .from('assinaturas')
      .update(updates)
      .eq('id', id);

    if (errorAss) throw errorAss;

    // Se o status da assinatura mudou, reflectir na escola
    if (updates.status) {
      const { error: errorEsc } = await s
        .from('escolas')
        .update({ status: updates.status })
        .eq('id', assBefore.escola_id);
      
      if (errorEsc) throw errorEsc;
    }

    await recordAuditServer({ 
      escolaId: assBefore.escola_id,
      portal: 'super_admin', 
      acao: 'BILLING_SUBSCRIPTION_UPDATED', 
      entity: 'assinaturas', 
      entityId: id, 
      details: {
        previous_status: assBefore.status,
        ...updates,
      },
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    const message = err.message || String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function checkIsAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('user_id', userId).single();
  return isSuperAdminRole(data?.role);
}
