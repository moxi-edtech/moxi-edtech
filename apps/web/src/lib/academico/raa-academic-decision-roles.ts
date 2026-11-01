import type { SupabaseClient } from "@supabase/supabase-js";

/** Academic decisions are restricted to these exact stored school roles.
 * Do not call user_has_role_in_school here: its admin aliases include
 * admin_financeiro and other operational staff permissions.
 */
export const RAA_ACADEMIC_DECISION_ROLES = ["admin", "admin_escola", "diretor"] as const;

export async function hasExactRaaAcademicDecisionRole(
  supabase: SupabaseClient<any>, escolaId: string, userId: string,
): Promise<boolean> {
  if (!escolaId || !userId) return false;
  const { data, error } = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  return !error && RAA_ACADEMIC_DECISION_ROLES.some((role) => role === data?.papel);
}
