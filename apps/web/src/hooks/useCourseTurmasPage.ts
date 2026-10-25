"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import type { CourseOverview } from "@/hooks/useCourseContext";

type Turma = CourseOverview["turmas"][number];
export type CourseTurmasPage = {
  items: Turma[]; total: number; page: number; pageSize: number; hasMore: boolean;
};
type Input = {
  context: EntityContext; enabled: boolean;
  page: number; classeId: string | null; search: string;
};
type Reply = { ok?: boolean; data?: CourseTurmasPage; error?: string };

export function courseTurmasPageKey(input: Omit<Input,"enabled">, settledSearch: string) {
  const { context } = input;
  return ["command-center", "curso-turmas", context.escolaId, context.id,
    context.academicYearId, input.classeId, input.page, settledSearch] as const;
}

export function courseTurmasPageHref(input: Omit<Input,"enabled">, settledSearch: string) {
  const { context } = input;
  const params = new URLSearchParams({
    page: String(input.page), pageSize: "25",
  });
  if (context.academicYearId) params.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  if (input.classeId) params.set("classeId", input.classeId);
  if (settledSearch) params.set("search", settledSearch);
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/cursos/${encodeURIComponent(context.id)}/turmas?${params}`;
}

export function useCourseTurmasPage(input: Input) {
  const search = input.search.trim().slice(0, 72);
  const debounced = useDebounce(search, 250);
  const querySettled = debounced === search;
  const query = useQuery({
    queryKey: courseTurmasPageKey(input, debounced),
    queryFn: async ({ signal }) => {
      const response = await fetch(courseTurmasPageHref(input, debounced), {
        credentials: "same-origin", cache: "no-store", signal,
      });
      const reply = await response.json().catch(() => null) as Reply | null;
      if (!response.ok || !reply?.ok || !reply.data ||
          !Array.isArray(reply.data.items) || reply.data.page !== input.page) {
        throw new Error(reply?.error || "Não foi possível carregar esta página de turmas.");
      }
      return reply.data;
    },
    enabled: input.enabled && querySettled,
    staleTime: 30_000, gcTime: 120_000,
    retry: 1, refetchOnWindowFocus: false,
  });
  // An in-flight search change may still have a cached previous page; never show it.
  const busy = !querySettled || query.isPending;
  return {
    data: querySettled ? query.data : undefined,
    busy,
    refreshing: query.isFetching && !query.isPending,
    error: querySettled && query.error
      ? query.error instanceof Error ? query.error.message : "Falha ao consultar turmas."
      : null,
    retry: query.refetch,
  };
}
