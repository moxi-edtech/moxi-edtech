"use client";

import { useEffect, useMemo, useState } from "react";
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

export function useGlobalSearch(escolaId?: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (!escolaId || !debouncedQuery || debouncedQuery.length < 2) {
        if (active) setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("search_alunos_global", {
          p_escola_id: escolaId,
          p_query: debouncedQuery,
          p_limit: 8,
        });
        if (error) throw error;
        if (active) setResults((data as SearchResult[]) ?? []);
      } catch (err) {
        console.error("[GlobalSearch] Erro na busca:", err);
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    runSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery, escolaId, supabase]);

  return { query, setQuery, results, loading };
}
