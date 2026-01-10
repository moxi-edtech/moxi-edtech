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

type MinimalResult = {
  id: string;
  label: string;
  meta?: string | null;
  href: string;
  status?: string | null;
};

type CacheEntry = { ts: number; data: SearchResult[] };

export function useGlobalSearch(escolaId?: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinimalResult[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizedQuery = useMemo(() => query.trim().replace(/\s+/g, " "), [query]);
  const debouncedQuery = useDebounce(normalizedQuery, 300);

  const supabase = useMemo(() => createClient(), []);

  // cache simples em memória (por aba)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  useEffect(() => {
    const q = debouncedQuery.trim();
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
      const items = ((cached.data as SearchResult[]) ?? []).map((a) => ({
        id: a.id,
        label: a.nome,
        meta: [a.processo ? `Proc. ${a.processo}` : null, a.turma].filter(Boolean).join(" • "),
        href: `/secretaria/alunos/${a.id}`,
        status: a.status ?? a.aluno_status ?? null,
      })) satisfies MinimalResult[];

      // @ts-expect-error: troca o tipo do state pra MinimalResult[]
      setResults(items);
      return;
    }

    const ac = new AbortController();
    setLoading(true);

    const limit = Math.min(8, 50);

    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "search_alunos_global_min",
          { p_escola_id: escolaId, p_query: q, p_limit: limit },
          { signal: ac.signal }
        );

        if (error) throw error;

        const payload = ((data as SearchResult[]) ?? []);
        cacheRef.current.set(cacheKey, { ts: now, data: payload });

        const items = payload.map((a) => ({
          id: a.id,
          label: a.nome,
          meta: [a.processo ? `Proc. ${a.processo}` : null, a.turma].filter(Boolean).join(" • "),
          href: `/secretaria/alunos/${a.id}`,
          status: a.status ?? a.aluno_status ?? null,
        })) satisfies MinimalResult[];

        // @ts-expect-error: troca o tipo do state pra MinimalResult[]
        setResults(items);
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
