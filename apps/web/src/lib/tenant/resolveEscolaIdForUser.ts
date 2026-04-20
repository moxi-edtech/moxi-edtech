import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { isEscolaUuid } from "./escolaSlug";
import { resolveEscolaParam } from "./resolveEscolaParam";

type Client = SupabaseClient<Database>;

type CacheEntry = { escolaId: string | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const getCacheKey = (userId: string, requestedEscolaId?: string | null) =>
  `${userId}:${requestedEscolaId ?? "default"}`;

export async function resolveEscolaIdForUser(
  client: Client,
  userId: string,
  requestedEscolaId?: string | null,
  _metadataEscolaId?: string | null
): Promise<string | null> {
  const cacheKey = getCacheKey(userId, requestedEscolaId ?? null);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.escolaId;
  }

  if (requestedEscolaId) {
    const normalizedRequestedId = isEscolaUuid(requestedEscolaId)
      ? requestedEscolaId
      : (await resolveEscolaParam(client, requestedEscolaId)).escolaId;
    if (!normalizedRequestedId) return null;

    const cacheAndReturn = (value: string) => {
      cache.set(cacheKey, { escolaId: value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    };

    try {
      const { data: allowed, error } = await client.rpc("has_access_to_escola_fast", {
        p_escola_id: normalizedRequestedId,
      });
      if (!error && allowed) return cacheAndReturn(String(normalizedRequestedId));
    } catch {}

    // Defensive fallback: in case RPC auth context is inconsistent, verify direct links.
    try {
      const { data: profileRows } = await client
        .from("profiles")
        .select("escola_id, current_escola_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
      const profileEscolaId = (profile?.current_escola_id ?? profile?.escola_id) as string | null | undefined;
      if (profileEscolaId && String(profileEscolaId) === String(normalizedRequestedId)) {
        return cacheAndReturn(String(normalizedRequestedId));
      }
    } catch {}

    try {
      const { data: vinc } = await client
        .from("escola_users")
        .select("user_id")
        .eq("escola_id", normalizedRequestedId)
        .eq("user_id", userId)
        .limit(1);
      if (Array.isArray(vinc) && vinc.length > 0) {
        return cacheAndReturn(String(normalizedRequestedId));
      }
    } catch {
      return null;
    }

    return null;
  }

  try {
    const { data: fallbackEscolaId } = await client.rpc("get_my_escola_id");
    if (fallbackEscolaId) {
      const resolved = String(fallbackEscolaId);
      cache.set(cacheKey, { escolaId: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
      return resolved;
    }
  } catch {
    return null;
  }

  return null;
}
