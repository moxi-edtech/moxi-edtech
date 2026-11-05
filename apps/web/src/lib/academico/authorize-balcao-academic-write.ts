import type { SupabaseClient } from "@supabase/supabase-js";
import { canManageBalcaoAcademic } from "@/lib/rematricula/balcao-academic-operation";

export async function authorizeBalcaoAcademicWrite(db: SupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await db.from("escola_users").select("papel")
    .eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  return !error && canManageBalcaoAcademic(data?.papel);
}
