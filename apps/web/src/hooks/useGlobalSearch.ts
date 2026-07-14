"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useDebounce } from "./useDebounce";
import { buildPortalHref } from "@/lib/navigation";

type SearchResult = {
  id: string;
  label: string;
  type: string;
  highlight: string | null;
  score: number;
  updated_at: string;
  created_at: string;
};

type SearchIntent = "financeiro" | "academico" | "perfil" | "documentos" | null;

export type SearchActionKind = "profile" | "payment" | "desk" | "grade";

export type SearchAction = {
  kind: SearchActionKind;
  label: string;
  href: string;
};

export type MinimalSearchResult = {
  id: string;
  label: string;
  type: string;
  highlight: string | null;
  href: string;
  intent?: SearchIntent;
  actions: SearchAction[];
};

const INTENT_MAP: Record<string, SearchIntent> = {
  pagar: "financeiro",
  cobrar: "financeiro",
  fatura: "financeiro",
  recibo: "financeiro",
  mensalidade: "financeiro",
  propina: "financeiro",
  nota: "academico",
  pauta: "academico",
  boletim: "academico",
  historico: "academico",
  ver: "perfil",
  perfil: "perfil",
  detalhe: "perfil",
  documento: "documentos",
  doc: "documentos",
  arquivo: "documentos",
};

function detectIntent(query: string): { intent: SearchIntent; cleanedQuery: string } {
  const tokens = query.trim().split(/\s+/);
  if (tokens.length < 2) return { intent: null, cleanedQuery: query };

  const firstToken = tokens[0].toLowerCase();
  const intent = INTENT_MAP[firstToken];

  if (intent) {
    return {
      intent,
      cleanedQuery: tokens.slice(1).join(" "),
    };
  }

  return { intent: null, cleanedQuery: query };
}

type Cursor = {
  score: number;
  updated_at: string;
  created_at: string;
  id: string;
};

type CacheEntry = {
  ts: number;
  data: SearchResult[];
  cursor: Cursor | null;
  hasMore: boolean;
};

type RecentEntry = SearchResult & {
  href: string;
  intent?: SearchIntent;
  lastUsedAt: number;
};

type PortalKey = "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";

type GlobalSearchOptions = {
  transformQuery?: (query: string) => string;
  types?: string[];
  portal?: PortalKey;
};

const SEARCH_CACHE_TTL_MS = 45_000;
const SEARCH_CACHE_MAX_AGE_MS = 5 * 60_000;
const RECENT_RESULTS_LIMIT = 6;
const searchCache = new Map<string, CacheEntry>();

function toRecentEntry(result: MinimalSearchResult): RecentEntry {
  return {
    id: result.id,
    label: result.label,
    type: result.type,
    highlight: result.highlight,
    score: 0,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    href: result.href,
    intent: result.intent,
    lastUsedAt: Date.now(),
  };
}

function recentStorageKey(escolaId: string | null | undefined, portal: PortalKey | undefined) {
  return `klasse:global-search:recent:${escolaId || "global"}:${portal || "default"}`;
}

function readRecentEntries(escolaId: string | null | undefined, portal: PortalKey | undefined): RecentEntry[] {
  if (typeof window === "undefined" || !escolaId) return [];

  try {
    const raw = window.localStorage.getItem(recentStorageKey(escolaId, portal));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is RecentEntry => Boolean(item?.id && item?.label && item?.type && item?.href))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, RECENT_RESULTS_LIMIT);
  } catch {
    return [];
  }
}

function writeRecentEntry(
  escolaId: string | null | undefined,
  portal: PortalKey | undefined,
  result: MinimalSearchResult,
) {
  if (typeof window === "undefined" || !escolaId) return;

  const next = [
    toRecentEntry(result),
    ...readRecentEntries(escolaId, portal).filter((item) => item.id !== result.id || item.type !== result.type),
  ].slice(0, RECENT_RESULTS_LIMIT);

  try {
    window.localStorage.setItem(recentStorageKey(escolaId, portal), JSON.stringify(next));
  } catch {
    // localStorage can fail in private browsing or quota pressure; search remains functional.
  }
}

const PORTAL_TYPES: Record<PortalKey, string[]> = {
  secretaria: ["aluno", "matricula", "turma", "documento", "candidatura"],
  financeiro: ["aluno", "mensalidade", "pagamento", "recibo"],
  admin: ["turma", "professor", "classe", "curso", "usuario"],
  operacoes: ["aluno", "matricula", "turma", "documento", "candidatura", "professor", "classe", "curso", "usuario"],
  professor: ["aluno"],
  aluno: ["aluno"],
  gestor: ["aluno"],
  superadmin: ["usuario"],
};

function resolveHref(
  portal: PortalKey | undefined,
  escolaId: string | null | undefined,
  item: { id: string; label: string; type: string },
  intent?: SearchIntent
) {
  const basePortal = portal || "secretaria";
  const escolaParam = escolaId ?? null;

  // Prioridade para intenção detectada
  if (intent === "financeiro") {
    if (item.type === "aluno" || item.type === "matricula") {
      return buildPortalHref(escolaParam, `/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`);
    }
  }

  if (intent === "documentos" && item.type === "aluno") {
    return buildPortalHref(escolaParam, basePortal === "operacoes" ? `/operacoes/documentos?alunoId=${item.id}` : `/secretaria/documentos?alunoId=${item.id}`);
  }

  if (basePortal === "professor") {
    return buildPortalHref(escolaParam, `/professor/notas?alunoId=${item.id}`);
  }

  if (basePortal === "financeiro") {
    if (item.type === "recibo") {
      return buildPortalHref(escolaParam, "/financeiro/radar");
    }
    return buildPortalHref(escolaParam, `/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`);
  }

  if (basePortal === "admin") {
    if (!escolaParam) return "/admin";
    switch (item.type) {
      case "turma":
        return buildPortalHref(escolaParam, "/admin/turmas");
      case "professor":
        return buildPortalHref(escolaParam, "/admin/professores");
      case "classe":
      case "curso":
        return buildPortalHref(escolaParam, "/admin/configuracoes");
      case "usuario":
        return buildPortalHref(escolaParam, "/admin/funcionarios");
      default:
        return buildPortalHref(escolaParam, "/admin");
    }
  }

  if (basePortal === "operacoes") {
    if (!escolaParam) return "/operacoes";
    switch (item.type) {
      case "turma":
        return buildPortalHref(escolaParam, "/operacoes/turmas");
      case "professor":
        return buildPortalHref(escolaParam, "/operacoes/professores");
      case "classe":
      case "curso":
        return buildPortalHref(escolaParam, "/operacoes/configuracoes");
      case "usuario":
        return buildPortalHref(escolaParam, "/admin/funcionarios");
      case "matricula":
        return buildPortalHref(escolaParam, `/operacoes/admissoes?matricula=${item.id}`);
      case "documento":
        return buildPortalHref(escolaParam, `/operacoes/documentos`);
      case "candidatura":
        return buildPortalHref(escolaParam, `/operacoes/admissoes?candidatura=${item.id}`);
      case "aluno":
      default:
        return buildPortalHref(escolaParam, `/operacoes/alunos/${item.id}`);
    }
  }

  switch (item.type) {
    case "turma":
      return buildPortalHref(escolaParam, `/secretaria/turmas/${item.id}`);
    case "matricula":
      return buildPortalHref(escolaParam, `/secretaria/admissoes?matricula=${item.id}`);
    case "documento":
      return buildPortalHref(escolaParam, `/secretaria/documentos`);
    case "candidatura":
      return buildPortalHref(escolaParam, `/secretaria/admissoes?candidatura=${item.id}`);
    case "mensalidade":
    case "pagamento":
    case "recibo":
      return buildPortalHref(escolaParam, `/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`);
    case "aluno":
    default:
      return buildPortalHref(escolaParam, `/secretaria/alunos/${item.id}`);
  }
}

function resolveStudentActions(
  portal: PortalKey | undefined,
  escolaId: string | null | undefined,
  item: { id: string; label: string; type: string },
): SearchAction[] {
  if (item.type !== "aluno") return [];

  const basePortal = portal || "secretaria";
  const escolaParam = escolaId ?? null;
  const encodedLabel = encodeURIComponent(item.label);

  const profileHref =
    basePortal === "operacoes"
      ? buildPortalHref(escolaParam, `/operacoes/alunos/${item.id}`)
      : buildPortalHref(escolaParam, `/secretaria/alunos/${item.id}`);

  const paymentHref =
    basePortal === "operacoes"
      ? buildPortalHref(escolaParam, `/operacoes/recebimentos?alunoId=${item.id}&q=${encodedLabel}`)
      : buildPortalHref(escolaParam, `/financeiro/pagamentos?alunoId=${item.id}&q=${encodedLabel}`);

  const deskHref =
    basePortal === "operacoes"
      ? buildPortalHref(escolaParam, `/secretaria/balcao?alunoId=${item.id}`)
      : buildPortalHref(escolaParam, `/secretaria/balcao?alunoId=${item.id}`);

  const gradeHref =
    basePortal === "professor"
      ? buildPortalHref(escolaParam, `/professor/notas?alunoId=${item.id}`)
      : buildPortalHref(escolaParam, `/secretaria/notas?alunoId=${item.id}`);

  return [
    { kind: "profile", label: "Perfil", href: profileHref },
    { kind: "payment", label: "Pagar", href: paymentHref },
    { kind: "desk", label: "Balcão", href: deskHref },
    { kind: "grade", label: "Nota", href: gradeHref },
  ];
}

type SecretariaAlunoFallbackRow = {
  id: string;
  nome?: string | null;
  nome_completo?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

function mapToMinimalResult(
  portal: PortalKey | undefined,
  escolaId: string | null | undefined,
  item: SearchResult,
  intent: SearchIntent,
): MinimalSearchResult {
  return {
    id: item.id,
    label: item.label,
    type: item.type,
    highlight: item.highlight,
    href: resolveHref(portal, escolaId, item, intent),
    intent,
    actions: resolveStudentActions(portal, escolaId, item),
  };
}

function mapRecentToMinimalResult(
  portal: PortalKey | undefined,
  escolaId: string | null | undefined,
  item: RecentEntry,
): MinimalSearchResult {
  return {
    id: item.id,
    label: item.label,
    type: item.type,
    highlight: item.highlight,
    href: item.href || resolveHref(portal, escolaId, item, item.intent),
    intent: item.intent,
    actions: resolveStudentActions(portal, escolaId, item),
  };
}

export function useGlobalSearch(escolaId?: string | null, options?: GlobalSearchOptions) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinimalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [recentResults, setRecentResults] = useState<MinimalSearchResult[]>([]);
  const transformQuery = options?.transformQuery;
  const portal = options?.portal;
  const types = options?.types;

  const { intent, cleanedQuery } = useMemo(() => detectIntent(query), [query]);

  const normalizedQuery = useMemo(() => cleanedQuery.trim().replace(/\s+/g, " "), [cleanedQuery]);
  const effectiveQuery = useMemo(() => {
    const next = transformQuery ? transformQuery(normalizedQuery) : normalizedQuery;
    return next.trim().replace(/\s+/g, " ");
  }, [normalizedQuery, transformQuery]);
  const debouncedQuery = useDebounce(effectiveQuery, 300);
  const resolvedTypes = useMemo(() => {
    if (types && types.length > 0) return types;
    if (portal && PORTAL_TYPES[portal]) return PORTAL_TYPES[portal];
    return ["aluno"];
  }, [types, portal]);

  const supabase = useMemo(() => createClient(), []);

  const cacheKey = useMemo(
    () => `${escolaId || "none"}:${portal || "default"}:${resolvedTypes.join("|")}:${effectiveQuery.toLowerCase()}`,
    [effectiveQuery, escolaId, portal, resolvedTypes],
  );
  const debouncedCacheKey = useMemo(
    () => `${escolaId || "none"}:${portal || "default"}:${resolvedTypes.join("|")}:${debouncedQuery.toLowerCase()}`,
    [debouncedQuery, escolaId, portal, resolvedTypes],
  );

  const refreshRecentResults = useCallback(() => {
    setRecentResults(readRecentEntries(escolaId, portal).map((item) => mapRecentToMinimalResult(portal, escolaId, item)));
  }, [escolaId, portal]);

  const rememberResult = useCallback((result: MinimalSearchResult) => {
    writeRecentEntry(escolaId, portal, result);
    refreshRecentResults();
  }, [escolaId, portal, refreshRecentResults]);

  useEffect(() => {
    refreshRecentResults();
  }, [refreshRecentResults]);

  useEffect(() => {
    const q = effectiveQuery.trim();
    if (!escolaId || q.length < 2) return;

    const cached = searchCache.get(cacheKey);
    if (!cached) return;

    setResults(cached.data.map((item) => mapToMinimalResult(portal, escolaId, item, intent)));
    setCursor(cached.cursor);
    setHasMore(cached.hasMore);
  }, [cacheKey, effectiveQuery, escolaId, portal, intent]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!escolaId || !q || q.length < 2) {
      setResults([]);
      setLoading(false);
      setCursor(null);
      setHasMore(false);
      return;
    }

    setCursor(null);
    setHasMore(false);

    const cached = searchCache.get(debouncedCacheKey);
    const now = Date.now();
    const hasUsableCache = Boolean(cached && now - cached.ts < SEARCH_CACHE_MAX_AGE_MS);

    if (cached && hasUsableCache) {
      const items = (cached.data ?? []).map((a) => mapToMinimalResult(options?.portal, escolaId, a, intent));

      setResults(items);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
    }

    const ac = new AbortController();
    setLoading(!hasUsableCache);

    const limit = Math.min(8, 50);

    const toCursor = (item: SearchResult): Cursor => ({
      score: item.score,
      updated_at: item.updated_at,
      created_at: item.created_at,
      id: item.id,
    });

    const fetchFallback = async () => {
      const params = new URLSearchParams({
        q,
        status: "todos",
        pageSize: String(limit),
      });
      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao buscar alunos");
      }

      const rawItems = (Array.isArray(json?.items) ? json.items : []) as SecretariaAlunoFallbackRow[];
      const payload: SearchResult[] = rawItems.map((row) => ({
        id: row.id,
        label: row.nome_completo || row.nome || "Aluno",
        type: "aluno",
        highlight: row.nome_completo || row.nome || null,
        score: 0,
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        created_at: row.created_at || new Date().toISOString(),
      }));

      const items = payload.map((a) => mapToMinimalResult(options?.portal, escolaId, a, intent));

      setResults(items);
      setCursor(null);
      setHasMore(false);

      searchCache.set(debouncedCacheKey, {
        ts: now,
        data: payload,
        cursor: null,
        hasMore: false,
      });
    };

    const fetchPage = async (pageCursor: Cursor | null, append: boolean) => {
      const { data, error } = await supabase.rpc(
        "search_global_entities",
        {
          p_escola_id: escolaId,
          p_query: q,
          p_types: resolvedTypes,
          p_limit: limit,
          p_cursor_score: pageCursor?.score ?? undefined,
          p_cursor_updated_at: pageCursor?.updated_at ?? undefined,
          p_cursor_created_at: pageCursor?.created_at ?? undefined,
          p_cursor_id: pageCursor?.id ?? undefined,
        });

      if (error) {
        const shouldFallback =
          error.code === "42883" ||
          error.message?.includes("search_global_entities") ||
          error.message?.includes("search_alunos_global_min") ||
          error.message?.includes("similarity");
        if (!append && shouldFallback) {
          await fetchFallback();
          return;
        }
        throw error;
      }

      const payload = ((data as SearchResult[]) ?? []);
      const nextCursor = payload.length === limit ? toCursor(payload[payload.length - 1]) : null;
      const items = payload.map((a) => mapToMinimalResult(options?.portal, escolaId, a, intent));

      setResults((prev) => (append ? [...prev, ...items] : items));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));

      if (!append) {
        searchCache.set(debouncedCacheKey, {
          ts: now,
          data: payload,
          cursor: nextCursor,
          hasMore: Boolean(nextCursor),
        });
      }
    };

    (async () => {
      try {
        if (cached && now - cached.ts < SEARCH_CACHE_TTL_MS) return;
        await fetchPage(null, false);
      } catch (err: unknown) {
        // ignore abort
        if (!isAbortError(err)) {
          console.error("[GlobalSearch] Erro na busca:", err);
          setResults([]);
          setCursor(null);
          setHasMore(false);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedCacheKey, debouncedQuery, escolaId, resolvedTypes, supabase, options?.portal, intent]);

  const loadMore = async () => {
    if (!cursor || loading || !escolaId || debouncedQuery.length < 2) return;
    setLoading(true);
    const ac = new AbortController();
    try {
      const { data, error } = await supabase.rpc(
        "search_global_entities",
        {
          p_escola_id: escolaId,
          p_query: debouncedQuery,
          p_types: resolvedTypes,
          p_limit: Math.min(8, 50),
          p_cursor_score: cursor.score,
          p_cursor_updated_at: cursor.updated_at,
          p_cursor_created_at: cursor.created_at,
          p_cursor_id: cursor.id,
        });

      if (error) throw error;

      const payload = ((data as SearchResult[]) ?? []);
      const nextCursor = payload.length === Math.min(8, 50)
        ? {
            score: payload[payload.length - 1].score,
            updated_at: payload[payload.length - 1].updated_at,
            created_at: payload[payload.length - 1].created_at,
            id: payload[payload.length - 1].id,
          }
        : null;

      const items = payload.map((a) => mapToMinimalResult(options?.portal, escolaId, a, intent));

      setResults((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        console.error("[GlobalSearch] Erro ao carregar mais:", err);
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  };

  return { query, setQuery, results, loading, hasMore, loadMore, detectedIntent: intent, recentResults, rememberResult };
}
