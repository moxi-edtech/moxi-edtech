import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { parsePlanTier, type PlanTier } from '@/config/plans';

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

    // 4. Mapeamento de preços por plano/ciclo
    const precosPorPlanoCiclo: Record<PlanTier, Record<'mensal' | 'anual', number | null>> = {
      essencial: {
        mensal: 60000,
        anual: 720000,
      },
      profissional: {
        mensal: 120000,
        anual: 1440000,
      },
      premium: {
        mensal: null,
        anual: null,
      },
    };

    // 5. Preparar inserts e relatório
    const dataRenovacao = new Date();
    dataRenovacao.setDate(dataRenovacao.getDate() + 30); // 30 dias a partir de hoje

    const agoraIso = new Date().toISOString();
    const inserts: Array<Record<string, unknown>> = [];
    const escolasCriadasViaSync: Array<Record<string, unknown>> = [];
    const escolasPendentesParametrizacao: Array<Record<string, unknown>> = [];

    for (const escola of escolasParaSync) {
      const plano = parsePlanTier(escola.plano_atual);
      const ciclo: 'mensal' | 'anual' = 'mensal';
      const valorDefinido = precosPorPlanoCiclo[plano]?.[ciclo] ?? null;

      if (plano === 'premium' && valorDefinido === null) {
        escolasPendentesParametrizacao.push({
          escola_id: escola.id,
          escola_nome: escola.nome,
          plano,
          ciclo,
          motivo: 'Plano premium exige valor_kz explícito (sem fallback automático).',
        });
      }

      if (typeof valorDefinido !== 'number' || Number.isNaN(valorDefinido) || valorDefinido <= 0) {
        escolasPendentesParametrizacao.push({
          escola_id: escola.id,
          escola_nome: escola.nome,
          plano,
          ciclo,
          motivo: 'Não foi criada assinatura: valor_kz inválido para o plano/ciclo.',
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
