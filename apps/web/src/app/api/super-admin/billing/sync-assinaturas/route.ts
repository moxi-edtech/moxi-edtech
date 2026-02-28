import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { parsePlanTier } from '@/config/plans';

export async function POST(req: NextRequest) {
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

    // 4. Mapeamento de preços por plano
    const precos: Record<string, number> = {
      essencial: 60000,
      profissional: 120000,
      premium: 0 // Negociado / Placeholder
    };

    // 5. Preparar inserts
    const dataRenovacao = new Date();
    dataRenovacao.setDate(dataRenovacao.getDate() + 30); // 30 dias a partir de hoje

    const inserts = escolasParaSync.map(e => ({
      escola_id: e.id,
      plano: parsePlanTier(e.plano_atual),
      ciclo: 'mensal',
      status: 'activa',
      metodo_pagamento: 'transferencia',
      valor_kz: precos[parsePlanTier(e.plano_atual)] || 60000,
      data_renovacao: dataRenovacao.toISOString(),
      data_inicio: new Date().toISOString()
    }));

    // 6. Inserir em lote
    const { error: insertError } = await s
      .from('assinaturas')
      .insert(inserts);

    if (insertError) throw insertError;

    return NextResponse.json({ 
      ok: true, 
      message: `${escolasParaSync.length} assinaturas inicializadas com sucesso.`,
      count: escolasParaSync.length
    });

  } catch (err: any) {
    const message = err.message || String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
