import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type EscolaUserRow = Database["public"]["Tables"]["escola_users"]["Row"];
type EscolaAdministradorRow = Database["public"]["Tables"]["escola_administradores"]["Row"];

export async function canManageEscolaResources(
  admin: SupabaseClient<Database>,
  escolaId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("role, escola_id, current_escola_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    const profileRow = profile as ProfileRow | null;
    const role = profileRow?.role as string | undefined;
    const escolaFromProfile = profileRow?.escola_id || profileRow?.current_escola_id;

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
    const { data: vinc } = await admin
      .from("escola_users")
      .select("papel, role")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .maybeSingle();
    const vincRow = vinc as EscolaUserRow | null;
    const papel = (vincRow?.papel ?? (vincRow as { role?: string | null } | null)?.role) as string | undefined;
    if (papel) return true;
  } catch {}

  try {
    const { data: adminLink } = await admin
      .from("escola_administradores")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1);
    const links = adminLink as EscolaAdministradorRow[] | null;
    if (links && links.length > 0) return true;
  } catch {}

  return false;
}
