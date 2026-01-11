import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export async function resolveEscolaIdForUser(
  client: Client,
  userId: string,
  requestedEscolaId?: string | null
): Promise<string | null> {
  let currentEscolaId: string | null = null;
  let legacyEscolaId: string | null = null;

  try {
    const { data: prof } = await client
      .from("profiles")
      .select("current_escola_id, escola_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const perfil = prof?.[0] as any;
    currentEscolaId = perfil?.current_escola_id ? String(perfil.current_escola_id) : null;
    legacyEscolaId = perfil?.escola_id ? String(perfil.escola_id) : null;
  } catch {}

  if (currentEscolaId) return currentEscolaId;

  if (requestedEscolaId) {
    try {
      const { data: vinc } = await client
        .from("escola_users")
        .select("escola_id")
        .eq("user_id", userId)
        .eq("escola_id", requestedEscolaId)
        .maybeSingle();
      const escolaId = (vinc as any)?.escola_id;
      if (escolaId) return String(escolaId);
    } catch {
      return legacyEscolaId && String(legacyEscolaId) === String(requestedEscolaId)
        ? legacyEscolaId
        : null;
    }

    return legacyEscolaId && String(legacyEscolaId) === String(requestedEscolaId)
      ? legacyEscolaId
      : null;
  }

  try {
    const { data: vincRows } = await client
      .from("escola_users")
      .select("escola_id")
      .eq("user_id", userId)
      .order("escola_id", { ascending: true })
      .limit(2);
    const uniqueIds = new Set(
      (vincRows || [])
        .map((row: any) => row?.escola_id)
        .filter((id: string | null | undefined) => Boolean(id))
        .map((id: string) => String(id))
    );
    if (uniqueIds.size === 1) return Array.from(uniqueIds)[0];
  } catch {}

  return legacyEscolaId ?? null;
}
