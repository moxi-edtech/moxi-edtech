import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, type Reference } from './core';
export type TestSession = { id: string; school_id: string; token_hash: string; flow_id: string; phone_id: string; expires_at: string;
  state: 'ready' | 'issuing' | 'issued' | 'simulating' | 'paid'; reference_payload: Reference | null };
export interface TestStore {
  ensure(row: TestSession): Promise<TestSession>;
  transition(row: TestSession, from: TestSession['state'], patch: Partial<TestSession>): Promise<TestSession | null>;
  current(row: TestSession): Promise<TestSession>;
}
// This table contains only sandbox fixtures. Never query production obligations or payment ledgers here.
export function testStore(db: SupabaseClient): TestStore {
  const checked = <T>(r: { data: T; error: unknown }) => { if (r.error) throw new PaymentError(503, 'Sessão de teste indisponível'); return r.data; };
  const scoped = (row: TestSession) => db.from('whatsapp_appypay_test_sessions').select('*').eq('id', row.id)
    .eq('school_id', row.school_id).eq('token_hash', row.token_hash).eq('flow_id', row.flow_id).eq('phone_id', row.phone_id);
  const current = async (row: TestSession) => {
    const r = checked(await scoped(row).gt('expires_at', new Date().toISOString()).single());
    if (!r) throw new PaymentError(403, 'Sessão de teste expirada'); return r as TestSession;
  };
  return {
    current,
    ensure: async row => {
      checked(await db.from('whatsapp_appypay_test_sessions').upsert(row, { onConflict: 'id', ignoreDuplicates: true }));
      return current(row);
    },
    transition: async (row, from, patch) => checked(await db.from('whatsapp_appypay_test_sessions').update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('school_id', row.school_id).eq('token_hash', row.token_hash).eq('flow_id', row.flow_id).eq('phone_id', row.phone_id)
      .eq('state', from).gt('expires_at', new Date().toISOString()).select('*').maybeSingle()) as TestSession | null,
  };
}
