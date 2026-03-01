import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { recordAuditServer } from '@/lib/audit';
import { sendMail, buildBillingRenewalEmail } from '@/lib/mailer';
import { PLAN_NAMES, type PlanTier } from '@/config/plans';

/**
 * API para Gestão Individual de Assinaturas (Cockpit Super Admin)
 */


function getExpectedValorKz(plano: PlanTier, ciclo: 'mensal' | 'anual'): number | null {
  const tabela: Record<PlanTier, Record<'mensal' | 'anual', number | null>> = {
    essencial: { mensal: 60000, anual: 720000 },
    profissional: { mensal: 120000, anual: 1440000 },
    premium: { mensal: null, anual: null },
  };

  return tabela[plano]?.[ciclo] ?? null;
}

function isValorKzValido({ plano, ciclo, valorKz }: { plano: PlanTier; ciclo: 'mensal' | 'anual'; valorKz: unknown }) {
  if (typeof valorKz !== 'number' || !Number.isFinite(valorKz) || valorKz <= 0) {
    return false;
  }

  const esperado = getExpectedValorKz(plano, ciclo);

  if (plano === 'premium') {
    return esperado === null;
  }

  return valorKz === esperado;
}

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

    if ('plano' in updates || 'ciclo' in updates || 'valor_kz' in updates) {
      const plano = (updates.plano ?? body.plano) as PlanTier | undefined;
      const ciclo = (updates.ciclo ?? body.ciclo) as 'mensal' | 'anual' | undefined;
      const valorKz = updates.valor_kz;

      if (!plano || !ciclo || !isValorKzValido({ plano, ciclo, valorKz: valorKz as unknown })) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Não é permitido salvar assinatura sem valor_kz válido para o plano/ciclo seleccionado.',
          },
          { status: 400 },
        );
      }
    }

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
    const { data: assBefore } = await s
      .from('assinaturas')
      .select('escola_id')
      .eq('id', id)
      .single();

    if (!assBefore) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada' }, { status: 404 });

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
