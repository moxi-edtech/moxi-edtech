// apps/web/src/app/admin/health/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function recalcAllAggregates() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_recalc_all_aggregates');
  if (error) {
    console.error('Error calling recalcAllAggregates RPC:', error);
    return { success: false, error: error.message };
  }
  return { success: true, data };
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
