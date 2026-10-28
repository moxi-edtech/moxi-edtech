import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { AppyPayClient, configForSchool, PaymentError, type Reference } from '@/lib/server/payments/providers/appypay/core';
import { reconcileCharge } from '@/lib/server/payments/providers/appypay/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) throw new PaymentError(403, 'Origem inválida');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new PaymentError(401, 'Não autenticado');
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) throw new PaymentError(403, 'Escola não identificada');
    const { data: allowed, error: permissionError } = await supabase.rpc('can_manage_school', { p_escola_id: escolaId });
    if (permissionError || !allowed) throw new PaymentError(403, 'Sem permissão financeira');
    const config = configForSchool(process.env.APPYPAY_CONFIG, escolaId);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.referenceId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.referenceId) ||
        Object.keys(body).some(key => key !== 'referenceId')) throw new PaymentError(400, 'Informe apenas referenceId');
    const { data: provider, error: providerError } = await supabase.from('school_payment_providers' as never)
      .select('id,environment').eq('school_id', escolaId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle();
    const selected = provider as { id: string; environment: string } | null;
    if (providerError || !selected || selected.environment !== config.environment) throw new PaymentError(409, 'Provedor indisponível');
    const { data, error } = await supabase.from('payment_references' as never).select('*')
      .eq('id', body.referenceId).eq('school_id', escolaId).eq('provider_id', selected.id).maybeSingle();
    if (error) throw new PaymentError(503, 'Consulta indisponível');
    if (!data) throw new PaymentError(404, 'Referência não encontrada');
    const result = await reconcileCharge(supabase, new AppyPayClient(config), data as Reference);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PaymentError ? error.message : 'Falha ao reconciliar pagamento' },
      { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}
