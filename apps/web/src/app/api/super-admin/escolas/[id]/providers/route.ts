import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteClient } from '@/lib/supabase/route-client';

export const dynamic = 'force-dynamic';

const providerSchema = z.object({
  providerType: z.enum(['whatsapp_manual', 'whatsapp_waha']),
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(['disabled', 'pending_qr', 'connected', 'disconnected', 'error']),
  dailyLimit: z.coerce.number().int().min(0).max(500),
  monthlyLimit: z.coerce.number().int().min(0).max(5000),
  sessionName: z.string().trim().max(120).optional().nullable(),
  fallbackPhone: z.string().trim().max(40).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await params;
    const parsed = providerSchema.safeParse(await req.json());

    if (!escolaId || !parsed.success) {
      return NextResponse.json({ ok: false, error: 'Payload invalido' }, { status: 400 });
    }

    const supabase = await createRouteClient();
    const { data: isSuperAdmin, error: authError } = await supabase.rpc('check_super_admin_role');

    if (authError || !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
    }

    const { providerType, displayName, status, dailyLimit, monthlyLimit, sessionName, fallbackPhone } = parsed.data;

    const { error } = await supabase
      .from('school_notification_providers')
      .upsert(
        {
          school_id: escolaId,
          provider_type: providerType,
          display_name: displayName,
          status,
          daily_limit: dailyLimit,
          monthly_limit: monthlyLimit,
          session_name: sessionName || null,
          config: {
            fallback_phone: fallbackPhone || null,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'school_id,provider_type' }
      )
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
