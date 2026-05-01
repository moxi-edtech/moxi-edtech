import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { parsePlanTier, type PlanTier } from '@/config/plans';
import type { Database } from '~types/supabase';

type PlanCommercialRow = {
  plan: PlanTier;
  price_mensal_kz: number | null;
  price_anual_kz?: number | null;
  trial_days?: number | null;
  discount_percent?: number | null;
  promo_ends_at?: string | null;
};

function resolveEffectivePrice(row: PlanCommercialRow | undefined, ciclo: 'mensal' | 'anual') {
  const base = Number(ciclo === 'anual' ? row?.price_anual_kz ?? 0 : row?.price_mensal_kz ?? 0);
  if (!Number.isFinite(base) || base <= 0) return null;

  const promoEndsAt = row?.promo_ends_at ? new Date(row.promo_ends_at) : null;
  const promoActive = !promoEndsAt || promoEndsAt.getTime() >= Date.now();
  const discount = promoActive ? Number(row?.discount_percent ?? 0) : 0;
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(base);

  return Math.max(0, Math.round(base * (1 - Math.min(100, discount) / 100)));
}

function resolveTrialDays(row: PlanCommercialRow | undefined) {
  const days = Number(row?.trial_days ?? 30);
  if (!Number.isFinite(days)) return 30;
  return Math.min(365, Math.max(0, Math.round(days)));
}

export async function POST(_req: NextRequest) {
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Auth: super_admin only
    const { data: rows } = await s.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    const role = (rows?.[0] as any)?.role as string | undefined;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    // 1. Buscar todas as escolas
    const { data: escolas, error: escError } = await s
      .from('escolas')
      .select('id, nome, plano_atual')
      .neq('status', 'excluida');

    if (escError) throw escError;

    // 2. Buscar IDs de escolas que já possuem assinatura
    const { data: assinaturasExistentes, error: assError } = await s
      .from('assinaturas')
      .select('escola_id');

    if (assError) throw assError;
    const idsComAssinatura = new Set((assinaturasExistentes || []).map(a => a.escola_id));

    // 3. Filtrar escolas que precisam de inicialização
    const escolasParaSync = (escolas || []).filter(e => !idsComAssinatura.has(e.id));

    if (escolasParaSync.length === 0) {
      return NextResponse.json({ ok: true, message: 'Todas as escolas já possuem assinaturas configuradas.' });
    }

    // 4. Mapeamento comercial configurável por plano/ciclo
    const { data: planRows, error: plansError } = await s
      .from('app_plan_limits')
      .select('plan, price_mensal_kz, price_anual_kz, trial_days, discount_percent, promo_ends_at');

    if (plansError) throw plansError;

    const commercialByPlan = new Map(
      ((planRows ?? []) as unknown as PlanCommercialRow[]).map((row) => [row.plan, row])
    );

    // 5. Preparar inserts e relatório
    const agoraIso = new Date().toISOString();
    const inserts: Database['public']['Tables']['assinaturas']['Insert'][] = [];
    const escolasCriadasViaSync: Array<Record<string, unknown>> = [];
    const escolasPendentesParametrizacao: Array<Record<string, unknown>> = [];

    for (const escola of escolasParaSync) {
      const plano = parsePlanTier(escola.plano_atual);
      const ciclo: 'mensal' | 'anual' = 'mensal';
      const commercial = commercialByPlan.get(plano);
      const valorDefinido = resolveEffectivePrice(commercial, ciclo);
      const trialDays = resolveTrialDays(commercial);
      const dataRenovacao = new Date();
      dataRenovacao.setDate(dataRenovacao.getDate() + trialDays);

      if (typeof valorDefinido !== 'number' || Number.isNaN(valorDefinido) || valorDefinido <= 0) {
        const motivo = plano === 'premium'
          ? 'Plano premium exige preço configurado no catálogo comercial.'
          : 'Preço configurado inválido para o plano/ciclo.';

        inserts.push({
          escola_id: escola.id,
          plano,
          ciclo,
          status: 'pendente',
          metodo_pagamento: 'transferencia',
          valor_kz: 0,
          data_renovacao: dataRenovacao.toISOString(),
          data_inicio: agoraIso,
          origem_registo: 'sync_bootstrap',
          motivo_origem: motivo,
        });

        escolasPendentesParametrizacao.push({
          escola_id: escola.id,
          escola_nome: escola.nome,
          plano,
          ciclo,
          motivo,
        });
        continue;
      }

      inserts.push({
        escola_id: escola.id,
        plano,
        ciclo,
        status: 'pendente',
        metodo_pagamento: 'transferencia',
        valor_kz: valorDefinido,
        data_renovacao: dataRenovacao.toISOString(),
        data_inicio: agoraIso,
        origem_registo: 'sync_bootstrap',
        motivo_origem: 'sync_bootstrap',
      });

      escolasCriadasViaSync.push({
        escola_id: escola.id,
        escola_nome: escola.nome,
        plano,
        ciclo,
        valor_kz: valorDefinido,
      });
    }

    // 6. Inserir em lote
    if (inserts.length > 0) {
      const { error: insertError } = await s
        .from('assinaturas')
        .insert(inserts);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      ok: true,
      message: `${inserts.length} assinaturas inicializadas em status pendente.`,
      count: inserts.length,
      report_super_admin: {
        total_escolas_sync: escolasParaSync.length,
        assinaturas_criadas: escolasCriadasViaSync.length,
        escolas_criadas: escolasCriadasViaSync,
        pendentes_parametrizacao: escolasPendentesParametrizacao.length,
        escolas_pendentes_parametrizacao: escolasPendentesParametrizacao,
      },
    });

  } catch (err: any) {
    const message = err.message || String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
