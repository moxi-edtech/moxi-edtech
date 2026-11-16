import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

/**
 * BI, nascimento e naturalidade só podem ser incluídos mediante privilégio
 * administrativo demonstrado no vínculo com a escola requerida.
 * O guard de emissão da lista continua obrigatório em todas as rotas.
 */
export async function canExportSensitiveRosterFields(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  userId: string
): Promise<boolean> {
  const { data: vinculo, error } = await supabase
    .from("escola_users")
    .select("papel, role")
    .eq("escola_id", escolaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !vinculo) return false;

  const role = String(vinculo.papel ?? vinculo.role ?? "").toLowerCase().trim();
  return [
    "admin",
    "admin_escola",
    "staff_admin",
    "diretor",
    "admin_secretaria",
    "admin_secretario",
  ].includes(role);
}
