import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { configForSchool } from '@/lib/server/payments/providers/appypay/core';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  if (process.env.APPYPAY_ENABLED !== 'true') return NextResponse.json({ enabled: false }, { headers });
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ enabled: false }, { status: 401, headers });
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, request.headers.get('x-escola-id'));
    if (!escolaId) return NextResponse.json({ enabled: false }, { status: 403, headers });
    const { data: allowed, error: permissionError } = await supabase.rpc('can_manage_school', { p_escola_id: escolaId });
    if (permissionError || !allowed) return NextResponse.json({ enabled: false }, { status: 403, headers });
    const config = configForSchool(process.env.APPYPAY_CONFIG, escolaId);
    const { data, error: providerError } = await supabase.from('school_payment_providers' as never).select('environment')
      .eq('school_id', escolaId).eq('provider_type', 'appypay').eq('status', 'active').maybeSingle();
    const provider = data as { environment: string } | null;
    return NextResponse.json({ enabled: !providerError && provider?.environment === config.environment,
      environment: config.environment, schoolId: escolaId }, { headers });
  } catch {
    return NextResponse.json({ enabled: false }, { headers });
  }
}
