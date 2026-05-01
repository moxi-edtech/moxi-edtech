import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { recordAuditServer } from '@/lib/audit';
import { sendMail, buildBillingRenewalEmail } from '@/lib/mailer';
import { PLAN_NAMES, type PlanTier } from '@/config/plans';

/**
 * API para Gestão Individual de Assinaturas (Cockpit Super Admin)
 */


type PlanCommercialRow = {
  price_mensal_kz?: number | null;
  price_anual_kz?: number | null;
  discount_percent?: number | null;
  promo_ends_at?: string | null;
};

async function getExpectedValorKz(s: any, plano: PlanTier, ciclo: 'mensal' | 'anual'): Promise<number | null> {
  const { data } = await s
    .from('app_plan_limits')
    .select('price_mensal_kz, price_anual_kz, discount_percent, promo_ends_at')
    .eq('plan', plano)
    .maybeSingle();

  const row = data as PlanCommercialRow | null;
  const base = Number(ciclo === 'anual' ? row?.price_anual_kz ?? 0 : row?.price_mensal_kz ?? 0);
  if (!Number.isFinite(base) || base <= 0) return null;

  const promoEndsAt = row?.promo_ends_at ? new Date(row.promo_ends_at) : null;
  const promoActive = !promoEndsAt || promoEndsAt.getTime() >= Date.now();
  const discount = promoActive ? Number(row?.discount_percent ?? 0) : 0;
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(base);

  return Math.max(0, Math.round(base * (1 - Math.min(100, discount) / 100)));
}

async function isValorKzValido(s: any, { plano, ciclo, valorKz }: { plano: PlanTier; ciclo: 'mensal' | 'anual'; valorKz: unknown }) {
  if (typeof valorKz !== 'number' || !Number.isFinite(valorKz) || valorKz <= 0) {
    return false;
  }

  const esperado = await getExpectedValorKz(s, plano, ciclo);

  if (esperado === null) {
    return esperado === null;
  }

  return valorKz === esperado;
}

async function syncFormacaoCenterSubscription(
  s: any,
  {
    escolaId,
    assinaturaStatus,
    dataRenovacao,
    timestamp,
  }: { escolaId: string; assinaturaStatus: string; dataRenovacao?: string | null; timestamp: string },
) {
  const { data: centro } = await s
    .from('centros_formacao')
    .select('id')
    .eq('escola_id', escolaId)
    .maybeSingle();

  if (!centro?.id) return false;

  const nextStatus =
    assinaturaStatus === 'activa'
      ? 'active'
      : assinaturaStatus === 'suspensa'
        ? 'past_due'
        : assinaturaStatus === 'cancelada'
          ? 'expired'
          : 'past_due';

  const updates: Record<string, unknown> = {
    subscription_status: nextStatus,
    subscription_updated_at: timestamp,
    updated_at: timestamp,
  };

  if (nextStatus === 'active' && dataRenovacao) {
    updates.trial_ends_at = dataRenovacao;
  }

  const { error } = await s
    .from('centros_formacao')
    .update(updates)
    .eq('escola_id', escolaId);

  if (error) throw error;
  return true;
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
    const { action, ...rawUpdates } = body;

    // 3. Actualizações (plano/ciclo/notas/status) + ações semânticas (suspender/reativar)
    const updates = { ...rawUpdates };
    if (action === 'suspend_subscription') updates.status = 'suspensa';
    if (action === 'reactivate_subscription') updates.status = 'activa';

    if ('plano' in updates || 'ciclo' in updates || 'valor_kz' in updates) {
      const plano = (updates.plano ?? body.plano) as PlanTier | undefined;
      const ciclo = (updates.ciclo ?? body.ciclo) as 'mensal' | 'anual' | undefined;
      const valorKz = updates.valor_kz;

      if (!plano || !ciclo || !(await isValorKzValido(s, { plano, ciclo, valorKz: valorKz as unknown }))) {
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
        .select('*, escolas:escola_id(nome, slug, escola_users(email, role, papel_escola))')
        .eq('id', id)
        .single();

      if (!ass) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada' }, { status: 404 });

      const admin = (ass.escolas as any)?.escola_users?.find((u: any) => u.role === 'admin' || u.papel_escola === 'admin_escola');
      if (!admin?.email) return NextResponse.json({ ok: false, error: 'Email do director não encontrado' }, { status: 400 });

      const escolaSlug = (ass.escolas as any)?.slug as string | undefined;
      const escolaParam = escolaSlug ? String(escolaSlug) : ass.escola_id;

      const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://klasse.ao").replace(/\/$/, "");
      const { subject, html, text } = await buildBillingRenewalEmail({
        escolaNome: (ass.escolas as any)?.nome || 'Director(a)',
        plano: PLAN_NAMES[ass.plano as PlanTier] || ass.plano,
        valor: `Kz ${ass.valor_kz.toLocaleString()}`,
        dataRenovacao: new Date(ass.data_renovacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }),
        diasRestantes: 30, // Placeholder para instrução inicial
        referencia: `KLASSE-${ass.escola_id.slice(0, 4)}-${ass.id.slice(0, 4)}`.toUpperCase(),
        linkPagamento: `${baseUrl}/escola/${escolaParam}/admin/configuracoes/assinatura`
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

    const { data: assBefore } = await s
      .from('assinaturas')
      .select('*')
      .eq('id', id)
      .single();

    if (!assBefore) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada' }, { status: 404 });

    // 2. Acções de comprovativo (confirmar/rejeitar)
    if (action === 'confirm_receipt' || action === 'reject_receipt') {
      const pagamentoId = body.pagamento_id;
      let pagamentoQuery = s
        .from('pagamentos_saas')
        .select('*')
        .eq('assinatura_id', id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (pagamentoId) {
        pagamentoQuery = s.from('pagamentos_saas').select('*').eq('id', pagamentoId).limit(1);
      }

      const { data: pagamentos, error: pagamentoError } = await pagamentoQuery;
      if (pagamentoError) throw pagamentoError;

      const pagamentoBefore = pagamentos?.[0];
      if (!pagamentoBefore) {
        return NextResponse.json({ ok: false, error: 'Pagamento não encontrado para esta assinatura' }, { status: 404 });
      }

      const nowIso = new Date().toISOString();
      const paymentStatus = action === 'confirm_receipt' ? 'confirmado' : 'falhado';
      const assinaturaStatus = action === 'confirm_receipt' ? 'activa' : 'pendente';

      const { error: pgUpdateError } = await s
        .from('pagamentos_saas')
        .update({
          status: paymentStatus,
          confirmado_por: sess.user.id,
          confirmado_em: nowIso,
        })
        .eq('id', pagamentoBefore.id);

      if (pgUpdateError) throw pgUpdateError;

      const { error: assUpdateError } = await s
        .from('assinaturas')
        .update({ status: assinaturaStatus })
        .eq('id', id);

      if (assUpdateError) throw assUpdateError;

      const { data: assAfter, error: assAfterError } = await s
        .from('assinaturas')
        .select('*')
        .eq('id', id)
        .single();

      if (assAfterError) throw assAfterError;

      const diff = buildSubscriptionDiff(assBefore, assAfter);
      const changedFields = diff.filter((field) => field.changed).map((field) => field.field);

      await s.from('escolas').update({ status: assAfter.status }).eq('id', assBefore.escola_id);
      const syncedFormacaoCenter = await syncFormacaoCenterSubscription(s, {
        escolaId: assBefore.escola_id,
        assinaturaStatus: assAfter.status,
        dataRenovacao: assAfter.data_renovacao,
        timestamp: nowIso,
      });

      await recordAuditServer({
        escolaId: assBefore.escola_id,
        portal: 'super_admin',
        acao: action === 'confirm_receipt' ? 'BILLING_RECEIPT_CONFIRMED' : 'BILLING_RECEIPT_REJECTED',
        entity: 'assinaturas',
        entityId: id,
        details: {
          before: pickTrackedFields(assBefore),
          after: pickTrackedFields(assAfter),
          changed_fields: changedFields,
          diff,
          actor_id: sess.user.id,
          timestamp: nowIso,
          pagamento_id: pagamentoBefore.id,
          pagamento_before_status: pagamentoBefore.status,
          pagamento_after_status: paymentStatus,
          formacao_center_synced: syncedFormacaoCenter,
        },
      });

      return NextResponse.json({ ok: true, diff, changed_fields: changedFields });
    }

    const { error: errorAss } = await s
      .from('assinaturas')
      .update(updates)
      .eq('id', id);

    if (errorAss) throw errorAss;

    if (updates.status) {
      const { error: errorEsc } = await s
        .from('escolas')
        .update({ status: updates.status })
        .eq('id', assBefore.escola_id);
      
      if (errorEsc) throw errorEsc;
    }

    const { data: assAfter, error: assAfterError } = await s
      .from('assinaturas')
      .select('*')
      .eq('id', id)
      .single();

    if (assAfterError) throw assAfterError;

    const nowIso = new Date().toISOString();
    const diff = buildSubscriptionDiff(assBefore, assAfter);
    const changedFields = diff.filter((field) => field.changed).map((field) => field.field);

    await recordAuditServer({
      escolaId: assBefore.escola_id,
      portal: 'super_admin',
      acao:
        action === 'suspend_subscription'
          ? 'BILLING_SUBSCRIPTION_SUSPENDED'
          : action === 'reactivate_subscription'
            ? 'BILLING_SUBSCRIPTION_REACTIVATED'
            : 'BILLING_SUBSCRIPTION_UPDATED',
      entity: 'assinaturas',
      entityId: id,
      details: {
        before: pickTrackedFields(assBefore),
        after: pickTrackedFields(assAfter),
        changed_fields: changedFields,
        diff,
        actor_id: sess.user.id,
        timestamp: nowIso,
      },
    });

    return NextResponse.json({ ok: true, diff, changed_fields: changedFields });

  } catch (err: any) {
    const message = err.message || String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type AssinaturaAuditShape = {
  plano: string | null;
  ciclo: string | null;
  status: string | null;
  valor_kz: number | null;
  notas_internas: string | null;
};

function pickTrackedFields(record: any): AssinaturaAuditShape {
  return {
    plano: record?.plano ?? null,
    ciclo: record?.ciclo ?? null,
    status: record?.status ?? null,
    valor_kz: record?.valor_kz ?? null,
    notas_internas: record?.notas_internas ?? null,
  };
}

function buildSubscriptionDiff(beforeRecord: any, afterRecord: any) {
  const before = pickTrackedFields(beforeRecord);
  const after = pickTrackedFields(afterRecord);

  return [
    { field: 'plano', before: before.plano, after: after.plano, changed: before.plano !== after.plano },
    { field: 'ciclo', before: before.ciclo, after: after.ciclo, changed: before.ciclo !== after.ciclo },
    { field: 'status', before: before.status, after: after.status, changed: before.status !== after.status },
    { field: 'valor_kz', before: before.valor_kz, after: after.valor_kz, changed: before.valor_kz !== after.valor_kz },
    {
      field: 'notas_internas',
      before: before.notas_internas,
      after: after.notas_internas,
      changed: before.notas_internas !== after.notas_internas,
    },
  ];
}

async function checkIsAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('user_id', userId).single();
  return isSuperAdminRole(data?.role);
}
