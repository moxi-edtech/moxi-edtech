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
      
      recordAuditServer({ 
        escolaId: ass.escola_id, 
        portal: 'super_admin', 
        acao: 'BILLING_INSTRUCTIONS_RESENT', 
        entity: 'assinaturas', 
        entityId: id 
      });

      return NextResponse.json({ ok: true, message: 'Instruções enviadas com sucesso' });
    }

    // 2. Actualizações Genéricas (Plano, Ciclo, Notas, Status)
    const { error } = await s
      .from('assinaturas')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    recordAuditServer({ 
      portal: 'super_admin', 
      acao: 'BILLING_SUBSCRIPTION_UPDATED', 
      entity: 'assinaturas', 
      entityId: id, 
      details: updates 
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
