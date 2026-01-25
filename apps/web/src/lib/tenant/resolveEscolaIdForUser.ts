import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export async function resolveEscolaIdForUser(
  client: Client,
  userId: string,
  requestedEscolaId?: string | null,
  metadataEscolaId?: string | null
): Promise<string | null> {
  if (metadataEscolaId && !requestedEscolaId) {
    return String(metadataEscolaId);
  }

  if (requestedEscolaId) {
    if (metadataEscolaId && String(metadataEscolaId) === String(requestedEscolaId)) {
      return String(requestedEscolaId);
    }
    const { data: allowed, error } = await client.rpc("has_access_to_escola_fast", {
      p_escola_id: requestedEscolaId,
    });
    if (error) return null;
    return allowed ? String(requestedEscolaId) : null;
  }

  const { data: fallbackEscolaId } = await client.rpc("get_my_escola_id");
  if (fallbackEscolaId) return String(fallbackEscolaId);

  return null;
}
