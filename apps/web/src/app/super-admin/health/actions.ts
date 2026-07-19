// apps/web/src/app/admin/health/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { requireSuperAdminRoute } from '@/lib/auth/requireSuperAdminRoute';

export async function recalcAllAggregates() {
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) {
    return { success: false, error: 'Somente Super Admin' };
  }

  try {
    const event = await inngest.send({
      name: 'admin/health.recalc-all-aggregates.requested',
      data: { requested_by: auth.user.id },
    });

    return { success: true, data: { queued: true, eventIds: event.ids } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar recálculo';
    console.error('Error queueing recalcAllAggregates:', error);
    return { success: false, error: message };
  }
}

export async function runOutboxWorker() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('process_outbox_batch_p0_v2', {
    p_batch_size: 50,
    p_max_retries: 5
  });

  if (error) {
    console.error('Error calling runOutboxWorker RPC:', error);
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function forceRefreshFinancialMVs() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_force_refresh_financial_mvs');

  if (error) {
    console.error('Error calling forceRefreshFinancialMVs RPC:', error);
    return { success: false, error: error.message };
  }
  return { success: true, data };
}
