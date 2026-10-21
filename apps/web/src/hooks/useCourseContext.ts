"use client";

import useSWR from "swr";
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

async function fetchCourse(url: string): Promise<CourseOverview> {
  const response = await fetch(url, { credentials: "same-origin" });
  const reply = (await response.json().catch(() => null)) as Reply | null;
  if (!response.ok || !reply?.ok || !reply.data) {
    throw new Error(reply?.error || "Não foi possível carregar este curso.");
  }
  return reply.data;
}

/** Scoped by tenant, entity and academic year; never cache across users after logout. */
export function useCourseContext(context: EntityContext) {
  const params = new URLSearchParams();
  if (context.academicYearId) params.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  const suffix = params.size ? `?${params.toString()}` : "";
  const url = `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/cursos/${encodeURIComponent(context.id)}${suffix}`;
  const result = useSWR<CourseOverview>(url, fetchCourse, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    errorRetryCount: 1,
    keepPreviousData: false,
  });
  return {
    ...result,
    error: result.error instanceof Error ? result.error.message : result.error ? "Falha ao carregar dados." : null,
    loading: result.isLoading,
    retry: () => result.mutate(),
  };
}
