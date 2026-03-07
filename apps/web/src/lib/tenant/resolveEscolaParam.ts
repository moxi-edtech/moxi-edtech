import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { isEscolaUuid } from "./escolaSlug";

type Client = SupabaseClient<Database>;

type SlugCacheEntry = {
  escolaId: string;
  slug: string;
  expiresAt: number;
};

const SLUG_CACHE_TTL_MS = 5 * 60 * 1000;
const SLUG_CACHE_MAX_ENTRIES = 500;
const slugCache = new Map<string, SlugCacheEntry>();
const escolaIdToSlug = new Map<string, string>();

export function getEscolaSlugCacheKey(slug: string) {
  return `tenant_slug:${slug.toLowerCase()}`;
}

export function invalidateEscolaSlugCache(slug?: string | null) {
  if (!slug) return;
  const cacheKey = getEscolaSlugCacheKey(slug);
  const cached = slugCache.get(cacheKey);
  if (!cached) return;
  slugCache.delete(cacheKey);
  if (escolaIdToSlug.get(cached.escolaId) === cached.slug.toLowerCase()) {
    escolaIdToSlug.delete(cached.escolaId);
  }
}

function getSlugCacheEntry(cacheKey: string) {
  const cached = slugCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    slugCache.delete(cacheKey);
    if (escolaIdToSlug.get(cached.escolaId) === cached.slug.toLowerCase()) {
      escolaIdToSlug.delete(cached.escolaId);
    }
    return null;
  }
  return cached;
}

function setSlugCacheEntry(escolaId: string, slug: string) {
  const normalizedSlug = slug.toLowerCase();
  const cacheKey = getEscolaSlugCacheKey(normalizedSlug);
  slugCache.set(cacheKey, {
    escolaId,
    slug,
    expiresAt: Date.now() + SLUG_CACHE_TTL_MS,
  });
  escolaIdToSlug.set(escolaId, normalizedSlug);

  if (slugCache.size > SLUG_CACHE_MAX_ENTRIES) {
    const oldestEntry = slugCache.entries().next().value as [string, SlugCacheEntry] | undefined;
    if (oldestEntry) {
      const [oldestKey, oldestValue] = oldestEntry;
      slugCache.delete(oldestKey);
      if (escolaIdToSlug.get(oldestValue.escolaId) === oldestValue.slug.toLowerCase()) {
        escolaIdToSlug.delete(oldestValue.escolaId);
      }
    }
  }
}

export type EscolaParamResolution = {
  escolaId: string | null;
  slug: string | null;
  paramType: "uuid" | "slug" | "unknown";
};

export async function resolveEscolaParam(
  client: Client,
  param: string
): Promise<EscolaParamResolution> {
  const trimmed = param.trim();
  if (!trimmed) {
    return { escolaId: null, slug: null, paramType: "unknown" };
  }

  const paramType = isEscolaUuid(trimmed) ? "uuid" : "slug";
  const column = paramType === "uuid" ? "id" : "slug";

  if (paramType === "slug") {
    const cacheKey = getEscolaSlugCacheKey(trimmed);
    const cached = getSlugCacheEntry(cacheKey);
    if (cached) {
      return {
        escolaId: cached.escolaId,
        slug: cached.slug,
        paramType,
      };
    }
  }

  const { data, error } = await client
    .from("escolas")
    .select("id, slug")
    .eq(column, trimmed)
    .maybeSingle();

  if (error || !data?.id) {
    return { escolaId: null, slug: null, paramType };
  }

  if (data.slug) {
    const cachedSlug = escolaIdToSlug.get(data.id);
    const normalizedSlug = data.slug.toLowerCase();
    if (cachedSlug && cachedSlug !== normalizedSlug) {
      invalidateEscolaSlugCache(cachedSlug);
    }
    setSlugCacheEntry(data.id, data.slug);
  }

  return {
    escolaId: data.id,
    slug: data.slug ?? null,
    paramType,
  };
}
