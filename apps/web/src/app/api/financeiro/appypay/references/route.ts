import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { AppyPayClient, configForSchool, PaymentError } from '@/lib/server/payments/providers/appypay/core';
import { issueReference } from '@/lib/server/payments/providers/appypay/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
    const url = new URL(request.url);
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new PaymentError(403, 'Origem inválida');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new PaymentError(401, 'Não autenticado');
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) throw new PaymentError(403, 'Escola não identificada');
    const { data: allowed, error } = await supabase.rpc('can_manage_school', { p_escola_id: escolaId });
    if (error || !allowed) throw new PaymentError(403, 'Sem permissão financeira');
    const config = configForSchool(process.env.APPYPAY_CONFIG, escolaId);
    const { data: provider, error: providerError } = await supabase.from('school_payment_providers' as never)
      .select('id,environment').eq('school_id', escolaId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle();
    const selected = provider as { id: string; environment: string } | null;
    if (providerError || !selected || selected.environment !== config.environment) throw new PaymentError(409, 'Provedor indisponível para esta escola');
    if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new PaymentError(413, 'Pedido demasiado grande');
    const body = await request.json().catch(() => null);
    if (!body || typeof body.obligationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.obligationId) ||
        Object.keys(body).some(key => key !== 'obligationId')) throw new PaymentError(400, 'Informe apenas obligationId');
    const reference = await issueReference(supabase, new AppyPayClient(config), escolaId, selected.id, body.obligationId);
    return NextResponse.json({ ok: true, reference }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PaymentError ? error.message : 'Falha ao emitir referência' },
      { status: error instanceof PaymentError ? error.status : 503, headers });
  }
}
