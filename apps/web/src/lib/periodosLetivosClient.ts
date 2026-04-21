"use client";

type PeriodosResponse = {
  periodos?: unknown[];
  ano_letivo?: { id: string; ano: number } | null;
  error?: string;
};

const inFlight = new Map<string, Promise<PeriodosResponse>>();

export async function fetchPeriodosLetivos(escolaIdOrSlug: string): Promise<PeriodosResponse> {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) return { periodos: [], ano_letivo: null, error: "Missing escola id" };

  const current = inFlight.get(key);
  if (current) return current;

  const request = fetch(`/api/escola/${encodeURIComponent(key)}/admin/periodos-letivos`, { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as PeriodosResponse | null;
      if (!res.ok) return { error: json?.error ?? "Erro ao carregar períodos" };
      return {
        periodos: Array.isArray(json?.periodos) ? json?.periodos : [],
        ano_letivo: json?.ano_letivo ?? null,
      } as PeriodosResponse;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
