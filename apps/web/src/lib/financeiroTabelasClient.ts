"use client";

type TabelaItem = Record<string, unknown>;
type FinanceiroTabelasResponse = {
  ok: boolean;
  items?: TabelaItem[];
  resolved?: unknown;
  error?: string;
};

type FetchFinanceiroTabelasParams = {
  escolaId: string;
  anoLetivo: string | number;
  cursoId?: string;
  classeId?: string;
};

const inFlight = new Map<string, Promise<FinanceiroTabelasResponse>>();
const cache = new Map<string, { expiresAt: number; value: FinanceiroTabelasResponse }>();
const FINANCEIRO_TABELAS_TTL_MS = 8_000;

function buildKey(params: FetchFinanceiroTabelasParams) {
  const escolaId = String(params.escolaId ?? "").trim();
  const anoLetivo = String(params.anoLetivo ?? "").trim();
  const cursoId = String(params.cursoId ?? "").trim();
  const classeId = String(params.classeId ?? "").trim();
  return `${escolaId}|${anoLetivo}|${cursoId}|${classeId}`;
}

function buildUrl(params: FetchFinanceiroTabelasParams) {
  const query = new URLSearchParams({
    escola_id: params.escolaId,
    ano_letivo: String(params.anoLetivo),
  });
  if (params.cursoId) query.set("curso_id", params.cursoId);
  if (params.classeId) query.set("classe_id", params.classeId);
  return `/api/financeiro/tabelas?${query.toString()}`;
}

export async function fetchFinanceiroTabelas(
  params: FetchFinanceiroTabelasParams
): Promise<FinanceiroTabelasResponse> {
  const key = buildKey(params);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const current = inFlight.get(key);
  if (current) return current;

  const request = fetch(buildUrl(params), { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) {
        const result = { ok: false, error: json?.error ?? "Erro ao carregar preços" } as FinanceiroTabelasResponse;
        cache.set(key, { value: result, expiresAt: Date.now() + 1_000 });
        return result;
      }
      const result = {
        ok: true,
        items: Array.isArray(json?.items) ? (json.items as TabelaItem[]) : [],
        resolved: json?.resolved ?? null,
      } as FinanceiroTabelasResponse;
      cache.set(key, { value: result, expiresAt: Date.now() + FINANCEIRO_TABELAS_TTL_MS });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function invalidateFinanceiroTabelasCache(escolaId?: string) {
  const key = String(escolaId ?? "").trim();
  if (!key) {
    cache.clear();
    inFlight.clear();
    return;
  }
  for (const cacheKey of [...cache.keys()]) {
    if (cacheKey.startsWith(`${key}|`)) cache.delete(cacheKey);
  }
  for (const inflightKey of [...inFlight.keys()]) {
    if (inflightKey.startsWith(`${key}|`)) inFlight.delete(inflightKey);
  }
}
