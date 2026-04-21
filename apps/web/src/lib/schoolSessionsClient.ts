"use client";

type SchoolSession = {
  id: string;
  status?: string | null;
  ano_letivo?: number | null;
  nome?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

type SchoolSessionsResponse = {
  ok: boolean;
  data?: SchoolSession[];
  error?: string;
};

const inFlight = new Map<string, Promise<SchoolSessionsResponse>>();
const cache = new Map<string, { expiresAt: number; value: SchoolSessionsResponse }>();
const SCHOOL_SESSIONS_TTL_MS = 30_000;

export async function fetchSchoolSessions(escolaIdOrSlug?: string): Promise<SchoolSessionsResponse> {
  const key = String(escolaIdOrSlug ?? "").trim();
  const cacheKey = key || "__default__";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const current = inFlight.get(cacheKey);
  if (current) return current;

  const qs = key ? `?escolaId=${encodeURIComponent(key)}` : "";
  const request = fetch(`/api/secretaria/school-sessions${qs}`, { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const result = { ok: false, error: json?.error ?? "Erro ao carregar sessões" } as SchoolSessionsResponse;
        cache.set(cacheKey, { value: result, expiresAt: Date.now() + 1_000 });
        return result;
      }
      const data = Array.isArray(json?.data)
        ? (json.data as SchoolSession[])
        : Array.isArray(json?.items)
          ? (json.items as SchoolSession[])
          : [];
      const result = { ok: true, data } as SchoolSessionsResponse;
      cache.set(cacheKey, { value: result, expiresAt: Date.now() + SCHOOL_SESSIONS_TTL_MS });
      return result;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, request);
  return request;
}

export function invalidateSchoolSessionsCache(escolaIdOrSlug?: string) {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) {
    cache.clear();
    inFlight.clear();
    return;
  }
  const cacheKey = key || "__default__";
  cache.delete(cacheKey);
  inFlight.delete(cacheKey);
}
