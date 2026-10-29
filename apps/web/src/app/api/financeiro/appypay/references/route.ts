import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { AppyPayClient, configForSchool, PaymentError, publicReference, sameAmount, type Reference } from '@/lib/server/payments/providers/appypay/core';
import { issueReference } from '@/lib/server/payments/providers/appypay/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function context(request: Request) {
  if (process.env.APPYPAY_ENABLED !== 'true') throw new PaymentError(503, 'AppyPay indisponível');
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) throw new PaymentError(403, 'Origem inválida');
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new PaymentError(401, 'Não autenticado');
  // A requested school is only a selector; membership and financial permission are checked server-side.
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, request.headers.get('x-escola-id'));
  if (!escolaId) throw new PaymentError(403, 'Escola não identificada');
  const { data: allowed, error } = await supabase.rpc('can_manage_school', { p_escola_id: escolaId });
  if (error || !allowed) throw new PaymentError(403, 'Sem permissão financeira');
  const config = configForSchool(process.env.APPYPAY_CONFIG, escolaId);
  const { data: provider, error: providerError } = await supabase.from('school_payment_providers' as never)
    .select('id,environment').eq('school_id', escolaId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle();
  const selected = provider as { id: string; environment: string } | null;
  if (providerError || !selected || selected.environment !== config.environment) throw new PaymentError(409, 'Provedor indisponível para esta escola');
  return { supabase, escolaId, config, provider: selected };
}
function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof PaymentError ? error.message : 'Falha ao consultar referência' },
    { status: error instanceof PaymentError ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    const { supabase, escolaId, config, provider } = await context(request);
    const id = new URL(request.url).searchParams.get('obligationId');
    if (!id || !uuid.test(id)) throw new PaymentError(400, 'Mensalidade inválida');
    const [{ data: obligation, error }, { data, error: refError }] = await Promise.all([
      supabase.from('mensalidades').select('valor,valor_previsto,valor_pago_total,status').eq('id', id).eq('escola_id', escolaId).maybeSingle(),
      supabase.from('payment_references' as never).select('*').eq('school_id', escolaId).eq('obligation_id', id)
        .in('status', ['pending', 'active', 'paid']).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error || refError) throw new PaymentError(503, 'Consulta indisponível');
    if (!obligation) throw new PaymentError(404, 'Mensalidade não encontrada');
    const amount = Math.round((Number(obligation.valor_previsto ?? obligation.valor) - Number(obligation.valor_pago_total ?? 0)) * 100) / 100;
    const existing = data as Reference | null;
    const reference = existing?.provider_id === provider.id && (existing.status === 'paid' || sameAmount(existing.amount, amount)) ? publicReference(existing) : null;
    const canIssue = Number.isFinite(amount) && amount > 0 && !['pago', 'isento', 'cancelado'].includes(String(obligation.status)) && !existing;
    return NextResponse.json({ ok: true, amount, currency: 'AOA', environment: config.environment, reference, canIssue,
      message: existing && !reference ? 'Existe uma referência que precisa de revisão pela tesouraria.' : null }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { supabase, escolaId, config, provider } = await context(request);
    if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new PaymentError(413, 'Pedido demasiado grande');
    const body = await request.json().catch(() => null);
    if (!body || typeof body.obligationId !== 'string' || !uuid.test(body.obligationId) ||
        typeof body.expectedAmount !== 'number' || !Number.isFinite(body.expectedAmount) || body.expectedAmount <= 0 ||
        Number(body.expectedAmount.toFixed(2)) !== body.expectedAmount ||
        Object.keys(body).some(key => !['obligationId', 'expectedAmount'].includes(key))) throw new PaymentError(400, 'Informe a mensalidade e o saldo apresentado na consulta.');
    const reference = await issueReference(supabase, new AppyPayClient(config), escolaId, provider.id, body.obligationId, body.expectedAmount);
    return NextResponse.json({ ok: true, reference }, { headers });
  } catch (error) { return failure(error); }
}
