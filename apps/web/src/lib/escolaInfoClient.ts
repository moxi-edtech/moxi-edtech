"use client";

export type EscolaInfo = {
  nome: string | null;
  plano: string | null;
  status: string | null;
};

const inFlight = new Map<string, Promise<EscolaInfo>>();

export async function fetchEscolaInfo(escolaIdOrSlug: string): Promise<EscolaInfo> {
  const key = String(escolaIdOrSlug || "").trim();
  if (!key) return { nome: null, plano: null, status: null };

  const cacheKey = `escolas:info:${key}`;
  if (typeof sessionStorage !== "undefined") {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as EscolaInfo;
        return {
          nome: parsed?.nome ?? null,
          plano: parsed?.plano ?? null,
          status: parsed?.status ?? null,
        };
      } catch {
        // ignore bad cache payload
      }
    }
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = fetch(`/api/escolas/${encodeURIComponent(key)}/nome`, {
    cache: "no-store",
  })
    .then(async (res) => {
      const json = await res.json().catch(() => null);
      const info: EscolaInfo = {
        nome: res.ok && json?.ok ? (json?.nome ?? null) : null,
        plano: res.ok && json?.ok ? (json?.plano ?? null) : null,
        status: res.ok && json?.ok ? (json?.status ?? null) : null,
      };

      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(cacheKey, JSON.stringify(info));
      }
      return info;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
