"use client";

type PeriodosResponse = {
  periodos?: unknown[];
  ano_letivo?: { id: string; ano: number } | null;
  error?: string;
};

const inFlight = new Map<string, Promise<PeriodosResponse>>();

export async function fetchPeriodosLetivos(escolaIdOrSlug: string, anoLetivoId?: string): Promise<PeriodosResponse> {
  const key = String(escolaIdOrSlug ?? "").trim() + (anoLetivoId ? `-${anoLetivoId}` : "");
  if (!key) return { periodos: [], ano_letivo: null, error: "Missing escola id" };

  const current = inFlight.get(key);
  if (current) return current;

  const url = `/api/escola/${encodeURIComponent(String(escolaIdOrSlug ?? "").trim())}/admin/periodos-letivos${anoLetivoId ? `?ano_letivo_id=${anoLetivoId}` : ""}`;
  
  const request = fetch(url, { cache: "no-store" })
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
