"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";

type Cursor = { name: string; id: string };
export type RosterStudent = {
  id: string;
  nome: string;
  numero: string | null;
  turmaId: string;
  turmaNome: string;
  numeroChamada: number | null;
};
type RosterReply = {
  ok: boolean;
  error?: string;
  items: RosterStudent[];
  total: number;
  size: number;
  hasMore: boolean;
  cursor: Cursor | null;
};

export type RosterSort = "nome_asc" | "nome_desc";
export function useExplorerRoster(context: EntityContext, type: "turma" | "classe", search: string, sort: RosterSort = "nome_asc") {
  const debounced = useDebounce(search.trim(), 300);
  const enabled = debounced.length >= 2 || (sort !== "nome_asc" && debounced.length === 0);
  const query = useInfiniteQuery({
    queryKey: ["command-center", "roster", context.escolaId, context.id, context.academicYearId, type, debounced, sort],
    initialPageParam: null as Cursor | null,
    enabled,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        type, entityId: context.id, q: debounced, size: "20", sort,
      });
      if (context.academicYearId) params.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
      if (pageParam) {
        params.set("cursorName", pageParam.name);
        params.set("cursorId", pageParam.id);
      }
      const poloId = new URLSearchParams(window.location.search).get("poloId") ?? new URLSearchParams(window.location.search).get("polo_id");
      if (poloId) params.set("poloId", poloId);
      const reply = await fetch(
        `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/roster?${params}`,
        { signal, credentials: "same-origin", cache: "no-store" },
      );
      const body = (await reply.json().catch(() => null)) as RosterReply | null;
      if (!reply.ok || !body?.ok) throw new Error(body?.error ?? "Não foi possível pesquisar os alunos.");
      return body;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor ?? undefined : undefined,
  });
  return {
    enabled,
    waitingForMinimum: search.trim().length > 0 && search.trim().length < 2,
    loading: enabled && query.isPending,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    sorting: sort,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    retry: query.refetch,
  };
}
