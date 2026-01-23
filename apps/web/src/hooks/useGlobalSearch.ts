"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useDebounce } from "./useDebounce";

type SearchResult = {
  id: string;
  label: string;
  type: string;
  highlight: string | null;
  score: number;
  updated_at: string;
  created_at: string;
};

type MinimalResult = {
  id: string;
  label: string;
  type: string;
  highlight: string | null;
  href: string;
};

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

type PortalKey = "secretaria" | "financeiro" | "admin" | "professor" | "aluno" | "gestor" | "superadmin";

type GlobalSearchOptions = {
  transformQuery?: (query: string) => string;
  types?: string[];
  portal?: PortalKey;
};

const PORTAL_TYPES: Record<PortalKey, string[]> = {
  secretaria: ["aluno", "matricula", "turma", "documento"],
  financeiro: ["aluno", "mensalidade", "pagamento", "recibo"],
  admin: ["turma", "professor", "classe", "curso", "usuario"],
  professor: ["aluno"],
  aluno: ["aluno"],
  gestor: ["aluno"],
  superadmin: ["usuario"],
};

function resolveHref(
  portal: PortalKey | undefined,
  escolaId: string | null | undefined,
  item: { id: string; label: string; type: string }
) {
  const basePortal = portal || "secretaria";
  if (basePortal === "professor") {
    return `/professor/notas?alunoId=${item.id}`;
  }

  if (basePortal === "financeiro") {
    if (item.type === "recibo") {
      return "/financeiro/cobrancas";
    }
    return escolaId
      ? `/escola/${escolaId}/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`
      : `/financeiro/cobrancas?q=${encodeURIComponent(item.label)}`;
  }

  if (basePortal === "admin") {
    if (!escolaId) return "/admin";
    switch (item.type) {
      case "turma":
        return `/escola/${escolaId}/admin/turmas`;
      case "professor":
        return `/escola/${escolaId}/admin/professores`;
      case "classe":
      case "curso":
        return `/escola/${escolaId}/admin/configuracoes`;
      case "usuario":
        return `/escola/${escolaId}/admin/funcionarios`;
      default:
        return `/escola/${escolaId}/admin`;
    }
  }

  switch (item.type) {
    case "turma":
      return `/secretaria/turmas/${item.id}`;
    case "matricula":
      return `/secretaria/admissoes?matricula=${item.id}`;
    case "documento":
      return `/secretaria/documentos`;
    case "mensalidade":
    case "pagamento":
    case "recibo":
      return escolaId
        ? `/escola/${escolaId}/financeiro/pagamentos?q=${encodeURIComponent(item.label)}`
        : `/financeiro/cobrancas?q=${encodeURIComponent(item.label)}`;
    case "aluno":
    default:
      return `/secretaria/alunos/${item.id}`;
  }
}

export function useGlobalSearch(escolaId?: string | null, options?: GlobalSearchOptions) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinimalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const normalizedQuery = useMemo(() => query.trim().replace(/\s+/g, " "), [query]);
  const effectiveQuery = useMemo(() => {
    const next = options?.transformQuery ? options.transformQuery(normalizedQuery) : normalizedQuery;
    return next.trim().replace(/\s+/g, " ");
  }, [normalizedQuery, options?.transformQuery]);
  const debouncedQuery = useDebounce(effectiveQuery, 300);
  const resolvedTypes = useMemo(() => {
    if (options?.types && options.types.length > 0) return options.types;
    if (options?.portal && PORTAL_TYPES[options.portal]) return PORTAL_TYPES[options.portal];
    return ["aluno"];
  }, [options?.types, options?.portal]);

  const supabase = useMemo(() => createClient(), []);

  // cache simples em memória (por aba)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

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

    const cacheKey = `${escolaId}:${resolvedTypes.join("|")}:${q.toLowerCase()}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    // TTL 45s
    if (cached && now - cached.ts < 45_000) {
      const items = (cached.data ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        type: a.type,
        highlight: a.highlight,
        href: resolveHref(options?.portal, escolaId, a),
      }));

      setResults(items);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

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

      const payload = ((json.items as any[]) ?? []).map((row) => ({
        id: row.id,
        label: row.nome_completo || row.nome || "Aluno",
        type: "aluno",
        highlight: row.nome_completo || row.nome || null,
        score: 0,
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        created_at: row.created_at || new Date().toISOString(),
      }));

      const items = payload.map((a) => ({
        id: a.id,
        label: a.label,
        type: a.type,
        highlight: a.highlight,
        href: resolveHref(options?.portal, escolaId, a),
      }));

      setResults(items);
      setCursor(null);
      setHasMore(false);

      cacheRef.current.set(cacheKey, {
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
          p_cursor_score: pageCursor?.score ?? null,
          p_cursor_updated_at: pageCursor?.updated_at ?? null,
          p_cursor_created_at: pageCursor?.created_at ?? null,
          p_cursor_id: pageCursor?.id ?? null,
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
      const items = payload.map((a) => ({
        id: a.id,
        label: a.label,
        type: a.type,
        highlight: a.highlight,
        href: resolveHref(options?.portal, escolaId, a),
      }));

      setResults((prev) => (append ? [...prev, ...items] : items));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));

      if (!append) {
        cacheRef.current.set(cacheKey, {
          ts: now,
          data: payload,
          cursor: nextCursor,
          hasMore: Boolean(nextCursor),
        });
      }
    };

    (async () => {
      try {
        await fetchPage(null, false);
      } catch (err: any) {
        // ignore abort
        if (err?.name !== "AbortError") {
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
  }, [debouncedQuery, escolaId, resolvedTypes, supabase, options?.portal]);

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

      const items = payload.map((a) => ({
        id: a.id,
        label: a.label,
        type: a.type,
        highlight: a.highlight,
        href: resolveHref(options?.portal, escolaId, a),
      }));

      setResults((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("[GlobalSearch] Erro ao carregar mais:", err);
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  };

  return { query, setQuery, results, loading, hasMore, loadMore };
}
