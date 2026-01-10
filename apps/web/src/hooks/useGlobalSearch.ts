"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useDebounce } from "./useDebounce";

type SearchResult = {
  id: string;
  nome: string;
  processo: string | null;
  turma: string | null;
  status: string | null;
  aluno_status?: string | null;
  turma_id?: string | null;
  aluno_bi?: string | null;
  foto_url?: string | null;
};

type CacheEntry = { ts: number; data: SearchResult[] };

export function useGlobalSearch(escolaId?: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizedQuery = useMemo(() => query.trim().replace(/\s+/g, " "), [query]);
  const debouncedQuery = useDebounce(normalizedQuery, 300);

  const supabase = useMemo(() => createClient(), []);

  // cache simples em memória (por aba)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  useEffect(() => {
    const q = debouncedQuery;
    if (!escolaId || !q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${escolaId}:${q.toLowerCase()}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    // TTL 45s
    if (cached && now - cached.ts < 45_000) {
      setResults(cached.data);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "search_alunos_global",
          { p_escola_id: escolaId, p_query: q, p_limit: 8 },
          { signal: ac.signal }
        );

        if (error) throw error;

        const payload = ((data as SearchResult[]) ?? []);
        cacheRef.current.set(cacheKey, { ts: now, data: payload });

        setResults(payload);
      } catch (err: any) {
        // ignore abort
        if (err?.name !== "AbortError") {
          console.error("[GlobalSearch] Erro na busca:", err);
          setResults([]);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedQuery, escolaId, supabase]);

  return { query, setQuery, results, loading };
}