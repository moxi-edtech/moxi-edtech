import type { SupabaseClient } from "@supabase/supabase-js";

/** Explicit stored school roles allowed to make academic decisions.
 * Do not rely on generic admin role aliases, which can include other roles
 * not authorized to conclude academic reviews.
 */
export const RAA_ACADEMIC_DECISION_ROLES = ["admin", "admin_escola", "diretor", "admin_financeiro", "secretaria", "admin_secretaria", "secretaria_financeiro"] as const;

export async function hasExactRaaAcademicDecisionRole(
  supabase: SupabaseClient<any>, escolaId: string, userId: string,
): Promise<boolean> {
  if (!escolaId || !userId) return false;
  const { data, error } = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  return !error && RAA_ACADEMIC_DECISION_ROLES.some((role) => role === data?.papel);
}
