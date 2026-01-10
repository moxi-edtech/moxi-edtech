import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function canManageEscolaResources(
  admin: SupabaseClient<Database>,
  escolaId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data: profile } = await (admin as any)
      .from("profiles")
      .select("role, escola_id, current_escola_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    const role = (profile as any)?.role as string | undefined;
    const escolaFromProfile = (profile as any)?.escola_id || (profile as any)?.current_escola_id;

    // Perfis com privilégios globais
    if (role === "super_admin" || role === "global_admin") return true;

    // Perfis vinculados à escola com funções operacionais
    if (
      (role === "admin" || role === "financeiro" || role === "secretaria" || role === "gestor") &&
      escolaFromProfile === escolaId
    )
      return true;
  } catch {}

  try {
    const { data: vinc } = await (admin as any)
      .from("escola_users")
      .select("papel, role")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .maybeSingle();
    const papel = ((vinc as any)?.papel ?? (vinc as any)?.role) as string | undefined;
    if (papel) return true;
  } catch {}

  try {
    const { data: adminLink } = await (admin as any)
      .from("escola_administradores")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1);
    if (adminLink && (adminLink as any[]).length > 0) return true;
  } catch {}

  return false;
}
