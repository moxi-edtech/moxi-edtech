"use client";

export type SetupBadges = {
  ano_letivo_ok?: boolean;
  periodos_ok?: boolean;
  avaliacao_ok?: boolean;
  curriculo_draft_ok?: boolean;
  curriculo_published_ok?: boolean;
  turmas_ok?: boolean;
};

type SetupStateResponse = {
  ok: boolean;
  data?: {
    stage?: string;
    next_action?: { label?: string; href?: string };
    blockers?: Array<{ title?: string; detail?: string; severity?: string }>;
    badges?: SetupBadges;
    completion_percent?: number;
  };
  error?: string;
};

const inFlight = new Map<string, Promise<SetupStateResponse>>();
const cache = new Map<string, { expiresAt: number; value: SetupStateResponse }>();
const SETUP_STATE_TTL_MS = 10_000;

export async function fetchSetupState(escolaIdOrSlug: string): Promise<SetupStateResponse> {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) return { ok: false, error: "Missing escola id" };

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const current = inFlight.get(key);
  if (current) return current;

  const request = fetch(`/api/escola/${encodeURIComponent(key)}/admin/setup/state`, { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as SetupStateResponse | null;
      if (res.status === 401) return { ok: false, error: "UNAUTHORIZED" };
      if (!res.ok) {
        const result = { ok: false, error: json?.error ?? "Erro ao carregar setup" } as SetupStateResponse;
        cache.set(key, { value: result, expiresAt: Date.now() + 1_000 });
        return result;
      }
      const result = { ok: true, data: json?.data } as SetupStateResponse;
      cache.set(key, { value: result, expiresAt: Date.now() + SETUP_STATE_TTL_MS });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function invalidateSetupStateCache(escolaIdOrSlug?: string) {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) {
    cache.clear();
    inFlight.clear();
    return;
  }
  cache.delete(key);
  inFlight.delete(key);
}

export function setupProgressFromBadges(badges?: SetupBadges) {
  const steps = [
    Boolean(badges?.ano_letivo_ok),
    Boolean(badges?.periodos_ok),
    Boolean(badges?.avaliacao_ok),
    Boolean(badges?.curriculo_published_ok),
    Boolean(badges?.turmas_ok),
  ];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}
