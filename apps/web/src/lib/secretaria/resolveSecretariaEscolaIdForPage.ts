import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export async function resolveSecretariaEscolaIdForPage(
  client: Client,
  userId: string,
  requestedEscolaParam?: string | null
) {
  const resolved = await resolveEscolaIdForUser(
    client,
    userId,
    requestedEscolaParam ?? null
  ).catch(() => null);

  if (resolved) return resolved;
  if (requestedEscolaParam) return null;

  const { data: profiles } = await client
    .from("profiles")
    .select("current_escola_id, escola_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const profileEscolaId = profile?.current_escola_id ?? profile?.escola_id;
  if (profileEscolaId) return String(profileEscolaId);

  const { data: vinculos } = await client
    .from("escola_users")
    .select("escola_id")
    .eq("user_id", userId)
    .limit(1);

  const vinculoEscolaId = Array.isArray(vinculos) ? vinculos[0]?.escola_id : null;
  return vinculoEscolaId ? String(vinculoEscolaId) : null;
}
