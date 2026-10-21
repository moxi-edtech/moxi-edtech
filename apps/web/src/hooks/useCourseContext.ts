"use client";

import { useQuery } from "@tanstack/react-query";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";

export type CourseOverview = {
  curso: { id: string; nome: string; codigo: string | null; nivel: string | null; descricao: string | null; status: string | null };
  anoLetivo: { id: string; ano: number; ativo: boolean };
  stats: { classes: number; turmas: number; alunos: number };
  classes: Array<{ id: string; nome: string; turmas: number; alunos: number }>;
  turmas: Array<{ id: string; nome: string; classeId: string | null; turno: string | null; capacidade: number | null; alunos: number }>;
  turmasLimitadas: boolean;
};

type Reply = { ok: boolean; data?: CourseOverview; error?: string };

/** Every cache key includes the tenant, course and academic-year scope. */
export function courseContextQueryKey(context: EntityContext) {
  return ["command-center", "curso", context.escolaId, context.id, context.academicYearId] as const;
}

export function courseContextHref(context: EntityContext) {
  const params = new URLSearchParams();
  if (context.academicYearId) params.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  const suffix = params.size ? `?${params.toString()}` : "";
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/cursos/${encodeURIComponent(context.id)}${suffix}`;
}

async function fetchCourse(url: string, signal: AbortSignal, expectedCourseId: string): Promise<CourseOverview> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  const reply = (await response.json().catch(() => null)) as Reply | null;
  if (!response.ok || !reply?.ok || !reply.data || reply.data.curso?.id !== expectedCourseId) {
    throw new Error(reply?.error || "Não foi possível carregar este curso.");
  }
  return reply.data;
}

/** The parent dialog owns the QueryClient and clears its cache on close. */
export function useCourseContext(context: EntityContext) {
  const result = useQuery({
    queryKey: courseContextQueryKey(context),
    queryFn: ({ signal }) => fetchCourse(courseContextHref(context), signal, context.id),
    staleTime: 45_000,
    gcTime: 120_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    data: result.data,
    error: result.error instanceof Error ? result.error.message : result.error ? "Falha ao carregar dados." : null,
    loading: result.isPending,
    refreshing: result.isFetching && !result.isPending,
    retry: result.refetch,
  };
}
