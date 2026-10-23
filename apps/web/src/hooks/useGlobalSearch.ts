"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useDebounce } from "./useDebounce";
import { buildPortalHref } from "@/lib/navigation";
import { visibleSearchResults } from "@/lib/command-center/search-visibility";
import {
  buildBalcaoActionHref,
  getStudentBalcaoActions,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

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

export type SearchActionKind = BalcaoActionId;

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

/** PRIV-01/02: only identifiers + display name; never BI/processo. Session memory only. */
type RecentEntry = {
  id: string;
  label: string;
  type: string;
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
const RECENT_SCOPE_LIMIT = 12;
const searchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_LIMIT = 50;
function storeCachedSearch(key: string, entry: CacheEntry) {
  searchCache.delete(key);
  searchCache.set(key, entry);
  while (searchCache.size > SEARCH_CACHE_LIMIT) {
    const oldest = searchCache.keys().next().value;
    if (oldest === undefined) break;
    searchCache.delete(oldest);
  }
}

/** In-memory recent results scoped by escola+portal for this tab/session only. */
const recentSessionStore = new Map<string, RecentEntry[]>();

function recentKey(escolaId: string | null | undefined, portal: PortalKey | undefined) {
  return `${escolaId || "global"}:${portal || "default"}`;
}

function legacyLocalStorageKey(escolaId: string | null | undefined, portal: PortalKey | undefined) {
  return `klasse:global-search:recent:${escolaId || "global"}:${portal || "default"}`;
}

function scrubLegacyLocalStorage(escolaId: string | null | undefined, portal: PortalKey | undefined) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(legacyLocalStorageKey(escolaId, portal));
  } catch {
    // ignore
  }
}

function readRecentEntries(escolaId: string | null | undefined, portal: PortalKey | undefined): RecentEntry[] {
  if (!escolaId) return [];
  scrubLegacyLocalStorage(escolaId, portal);
  const list = recentSessionStore.get(recentKey(escolaId, portal)) ?? [];
  return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, RECENT_RESULTS_LIMIT);
}

function writeRecentEntry(
  escolaId: string | null | undefined,
  portal: PortalKey | undefined,
  result: MinimalSearchResult,
) {
  if (!escolaId) return;
  scrubLegacyLocalStorage(escolaId, portal);
  const entry: RecentEntry = {
    id: result.id,
    label: result.label,
    type: result.type,
    href: result.href,
    intent: result.intent,
    lastUsedAt: Date.now(),
  };
  const key = recentKey(escolaId, portal);
  const next = [
    entry,
    ...readRecentEntries(escolaId, portal).filter((item) => item.id !== result.id || item.type !== result.type),
  ].slice(0, RECENT_RESULTS_LIMIT);
  recentSessionStore.delete(key);
  recentSessionStore.set(key, next);
  while (recentSessionStore.size > RECENT_SCOPE_LIMIT) {
    const oldest = recentSessionStore.keys().next().value;
    if (oldest === undefined) break;
    recentSessionStore.delete(oldest);
  }
}

export function clearRecentSearchSession(escolaId?: string | null, portal?: PortalKey) {
  if (escolaId) {
    recentSessionStore.delete(recentKey(escolaId, portal));
    scrubLegacyLocalStorage(escolaId, portal);
    return;
  }
  recentSessionStore.clear();
}

const PORTAL_TYPES: Record<PortalKey, string[]> = {
  secretaria: ["aluno", "matricula", "turma", "documento", "candidatura", "classe", "curso", "professor"],
  financeiro: ["aluno", "mensalidade", "pagamento", "recibo"],
  admin: ["aluno", "turma", "professor", "classe", "curso", "usuario"],
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
  intent?: SearchIntent,
) {
  const basePortal = portal || "secretaria";
  const escolaParam = escolaId ?? null;

  if (intent === "financeiro") {
    if (item.type === "aluno" || item.type === "matricula") {
      return buildPortalHref(escolaParam, `/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`);
    }
  }

  if (intent === "documentos" && item.type === "aluno") {
    return buildPortalHref(
      escolaParam,
      basePortal === "operacoes" ? `/operacoes/documentos?alunoId=${item.id}` : `/secretaria/documentos?alunoId=${item.id}`,
    );
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

  const actions = getStudentBalcaoActions();
  const visibleActions =
    portal === "secretaria" || portal === "operacoes" || portal == null
      ? actions
      : actions.filter((action) => ["profile", "payment", "desk", "grade"].includes(action.id));

  return visibleActions.map((action) => ({
    kind: action.id,
    label: action.shortLabel,
    href: buildBalcaoActionHref({
      escolaParam: escolaId ?? null,
      actionId: action.id,
      alunoId: item.id,
      alunoLabel: item.label,
      portal,
    }),
  }));
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

function isMissingGlobalSearchRpcError(error: {
  code?: string | null;
  message?: string | null;
  status?: number | null;
} | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.status === 404 ||
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    message.includes("search_global_entities") ||
    message.includes("search_alunos_global_min") ||
    message.includes("similarity")
  );
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
    highlight: null,
    href: item.href || resolveHref(portal, escolaId, item, item.intent),
    intent: item.intent,
    actions: resolveStudentActions(portal, escolaId, item),
  };
}

export function useGlobalSearch(escolaId?: string | null, options?: GlobalSearchOptions) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinimalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const generationRef = useRef(0);
  const pagingAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    // Invalidate in-flight RPC as soon as the operator changes the query/scope,
    // rather than waiting for the debounce to complete.
    generationRef.current += 1;
    pagingAbortRef.current?.abort();
    return () => { generationRef.current += 1; pagingAbortRef.current?.abort(); };
  }, [effectiveQuery, escolaId, portal, resolvedTypes]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        generationRef.current += 1;
        pagingAbortRef.current?.abort();
        searchCache.clear();
        recentSessionStore.clear();
        setResults([]);
        setLoading(false);
        setCursor(null);
        setHasMore(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    searchCache.clear();
    recentSessionStore.clear();
    pagingAbortRef.current?.abort();
  }, [escolaId, portal]);

  const cacheKey = useMemo(
    () => `${escolaId || "none"}:${portal || "default"}:${resolvedTypes.join("|")}:${effectiveQuery.toLowerCase()}`,
    [effectiveQuery, escolaId, portal, resolvedTypes],
  );
  const debouncedCacheKey = useMemo(
    () => `${escolaId || "none"}:${portal || "default"}:${resolvedTypes.join("|")}:${debouncedQuery.toLowerCase()}`,
    [debouncedQuery, escolaId, portal, resolvedTypes],
  );

  const refreshRecentResults = useCallback(() => {
    setRecentResults(
      readRecentEntries(escolaId, portal).map((item) => mapRecentToMinimalResult(portal, escolaId, item)),
    );
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

    setResults(visibleSearchResults(cached.data, portal).map((item) => mapToMinimalResult(portal, escolaId, item, intent)));
    setCursor(cached.cursor);
    setHasMore(cached.hasMore);
  }, [cacheKey, effectiveQuery, escolaId, portal, intent]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!escolaId || !q || q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      setCursor(null);
      setHasMore(false);
      return;
    }

    setCursor(null);
    setHasMore(false);
    setError(null);

    const cached = searchCache.get(debouncedCacheKey);
    const now = Date.now();
    const hasUsableCache = Boolean(cached && now - cached.ts < SEARCH_CACHE_MAX_AGE_MS);

    if (cached && hasUsableCache) {
      const items = visibleSearchResults(cached.data ?? [], portal).map((a) => mapToMinimalResult(portal, escolaId, a, intent));
      setResults(items);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
    }

    const ac = new AbortController();
    const generation = ++generationRef.current;
    const isCurrent = () => !ac.signal.aborted && generationRef.current === generation;
    pagingAbortRef.current?.abort();
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
      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, {
        signal: ac.signal,
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao buscar alunos");
      }

      const rawItems = (Array.isArray(json?.items) ? json.items : []) as SecretariaAlunoFallbackRow[];
      const payload: SearchResult[] = rawItems.map((row) => ({
        id: row.id,
        label: row.nome_completo || row.nome || "Aluno",
        type: "aluno",
        highlight: null,
        score: 0,
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        created_at: row.created_at || new Date().toISOString(),
      }));

      const items = visibleSearchResults(payload, portal).map((a) => mapToMinimalResult(portal, escolaId, a, intent));

      if (!isCurrent()) return;
      setResults(items);
      setCursor(null);
      setHasMore(false);
      setError(null);

      storeCachedSearch(debouncedCacheKey, {
        ts: now,
        data: payload,
        cursor: null,
        hasMore: false,
      });
    };

    const fetchPage = async (pageCursor: Cursor | null, append: boolean) => {
      const { data, error: rpcError } = await supabase.rpc("search_global_entities", {
        p_escola_id: escolaId,
        p_query: q,
        p_types: resolvedTypes,
        p_limit: limit,
        p_cursor_score: pageCursor?.score ?? undefined,
        p_cursor_updated_at: pageCursor?.updated_at ?? undefined,
        p_cursor_created_at: pageCursor?.created_at ?? undefined,
        p_cursor_id: pageCursor?.id ?? undefined,
      }).abortSignal(ac.signal);

      if (rpcError) {
        if (!append && isMissingGlobalSearchRpcError(rpcError)) {
          await fetchFallback();
          return;
        }
        throw rpcError;
      }

      if (!isCurrent()) return;
      const payload = ((data as SearchResult[]) ?? []);
      const nextCursor = payload.length === limit ? toCursor(payload[payload.length - 1]) : null;
      const items = visibleSearchResults(payload, portal).map((a) => mapToMinimalResult(portal, escolaId, a, intent));

      setResults((prev) => (append ? [...prev, ...items] : items));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
      setError(null);

      if (!append) {
        storeCachedSearch(debouncedCacheKey, {
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
        if (isCurrent() && !isAbortError(err)) {
          setResults([]);
          setCursor(null);
          setHasMore(false);
          setError("Não foi possível concluir a pesquisa. Tente novamente.");
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedCacheKey, debouncedQuery, escolaId, resolvedTypes, supabase, portal, intent]);

  const loadMore = async () => {
    if (!cursor || loading || !escolaId || debouncedQuery.length < 2 || effectiveQuery !== debouncedQuery) return;
    const generation = generationRef.current;
    const ac = new AbortController();
    pagingAbortRef.current?.abort();
    pagingAbortRef.current = ac;
    const isCurrent = () => !ac.signal.aborted && generationRef.current === generation;
    setLoading(true);
    setError(null);
    try {
      const limit = Math.min(8, 50);
      const { data, error: rpcError } = await supabase.rpc("search_global_entities", {
        p_escola_id: escolaId,
        p_query: debouncedQuery,
        p_types: resolvedTypes,
        p_limit: limit,
        p_cursor_score: cursor.score,
        p_cursor_updated_at: cursor.updated_at,
        p_cursor_created_at: cursor.created_at,
        p_cursor_id: cursor.id,
      }).abortSignal(ac.signal);

      if (rpcError) throw rpcError;
      if (!isCurrent()) return;

      const payload = ((data as SearchResult[]) ?? []);
      const nextCursor = payload.length === limit
        ? {
            score: payload[payload.length - 1].score,
            updated_at: payload[payload.length - 1].updated_at,
            created_at: payload[payload.length - 1].created_at,
            id: payload[payload.length - 1].id,
          }
        : null;

      const items = visibleSearchResults(payload, portal).map((a) => mapToMinimalResult(portal, escolaId, a, intent));

      setResults((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } catch (err: unknown) {
      if (isCurrent() && !isAbortError(err)) {
        setError("Não foi possível carregar mais resultados.");
      }
    } finally {
      if (isCurrent()) setLoading(false);
      if (pagingAbortRef.current === ac) pagingAbortRef.current = null;
    }
  };

  const clearError = useCallback(() => setError(null), []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearError,
    hasMore,
    loadMore,
    detectedIntent: intent,
    recentResults,
    rememberResult,
  };
}
