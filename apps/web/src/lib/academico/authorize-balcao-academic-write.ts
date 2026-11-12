import type { SupabaseClient } from "@supabase/supabase-js";
import { canManageBalcaoAcademic } from "@/lib/rematricula/balcao-academic-operation";

export async function authorizeBalcaoAcademicWrite(db: SupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await db.from("escola_users").select("papel")
    .eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  return !error && canManageBalcaoAcademic(data?.papel);
}

/** Exact school roles allowed to complete the individual academic recovery.
 * This is the user-authorized Balcão workflow, never a generic finance role alias.
 * Every endpoint and PostgreSQL RPC must still verify escola_id and auth.uid().
 */
export const BALCAO_HISTORIC_OPERATOR_ROLES = [
  "secretaria", "admin", "admin_escola", "staff_admin", "diretor",
  "admin_financeiro", "admin_secretaria", "admin_secretario",
] as const;

/** Pendente is an academic recovery state, not an invitation to finance staff
 * or ordinary teachers to modify a historical student's grades.
 */
export async function authorizeBalcaoPendingAcademicWrite(db: SupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await db.from("escola_users").select("papel")
    .eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  return !error && BALCAO_HISTORIC_OPERATOR_ROLES.some((role) => role === data?.papel);
}
