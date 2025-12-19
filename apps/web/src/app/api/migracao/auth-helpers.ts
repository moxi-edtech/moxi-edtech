import type { Database } from "~types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function userHasAccessToEscola(
  admin: SupabaseClient<Database>,
  escolaId: string,
  userId: string,
): Promise<boolean> {
  try {
    const { data: vinc } = await admin
      .from("escola_users")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1);
    if (vinc && vinc.length > 0) return true;
  } catch {}

  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .or(`current_escola_id.eq.${escolaId},escola_id.eq.${escolaId}`)
      .limit(1);
    if (prof && prof.length > 0) return true;
  } catch {}

  return false;
}

export async function importBelongsToEscola(
  admin: SupabaseClient<Database>,
  importId: string,
  escolaId: string,
): Promise<boolean> {
  try {
    const { data } = await admin
      .from("import_migrations")
      .select("escola_id")
      .eq("id", importId)
      .limit(1);
    const real = (data?.[0] as any)?.escola_id as string | undefined;
    return !!real && String(real) === String(escolaId);
  } catch {
    return false;
  }
}

