import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { isSuperAdminRole } from '@/lib/auth/requireSuperAdminAccess';
import { buildBillingDashboardSummary } from '@/lib/super-admin/billing-dashboard-summary';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { data: rows } = await s
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const role = (rows?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    const { data: assinaturas, error: assinaturasError } = await s
      .from('assinaturas')
      .select('id, ciclo, status, valor_kz, data_renovacao, created_at');

    if (assinaturasError) {
      throw assinaturasError;
    }

    const { data: pagamentos, error: pagamentosError } = await s
      .from('pagamentos_saas')
      .select('assinatura_id, status, comprovativo_url, periodo_fim, created_at');

    if (pagamentosError) {
      throw pagamentosError;
    }

    const normalizedAssinaturas = (assinaturas ?? []).map((row) => ({
      id: row.id,
      ciclo: row.ciclo === 'anual' ? ('anual' as const) : ('mensal' as const),
      status: row.status,
      valor_kz: row.valor_kz,
      data_renovacao: row.data_renovacao,
      created_at: row.created_at,
    }));


    const normalizedPagamentos = (pagamentos ?? []).map((row) => ({
      assinatura_id: row.assinatura_id,
      status: row.status,
      comprovativo_url: row.comprovativo_url,
      periodo_fim: row.periodo_fim,
      created_at: row.created_at ?? new Date(0).toISOString(),
    }));

    const summary = buildBillingDashboardSummary(normalizedAssinaturas, normalizedPagamentos);


    return NextResponse.json({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
