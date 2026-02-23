import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

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
  metadataEscolaId?: string | null
): Promise<string | null> {
  if (metadataEscolaId && !requestedEscolaId) {
    return String(metadataEscolaId);
  }

  const cacheKey = getCacheKey(userId, requestedEscolaId ?? null);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.escolaId;
  }

  if (requestedEscolaId) {
    if (metadataEscolaId && String(metadataEscolaId) === String(requestedEscolaId)) {
      return String(requestedEscolaId);
    }
    try {
      const { data: allowed, error } = await client.rpc("has_access_to_escola_fast", {
        p_escola_id: requestedEscolaId,
      });
      if (error) return null;
      const resolved = allowed ? String(requestedEscolaId) : null;
      if (resolved) {
        cache.set(cacheKey, { escolaId: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return resolved;
    } catch {
      return null;
    }
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
