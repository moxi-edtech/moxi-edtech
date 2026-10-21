"use client";

import { useQuery } from "@tanstack/react-query";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";

export type ClasseOverview = {
  classe: {
    id: string; nome: string; numero: number | null;
    cargaHorariaSemanal: number | null;
    curso: { id: string; nome: string; codigo: string | null } | null;
  };
  anoLetivo: { id: string; ano: number; historico: boolean };
  stats: {
    turmas: number; alunos: number; capacidade: number | null;
    disciplinas: number; professores: number;
  };
  turmas: Array<{
    id: string; nome: string; turno: string | null; sala: string | null;
    capacidade: number | null; alunos: number; professores: number; disciplinas: number;
  }>;
  disciplinas: Array<{
    id: string; nome: string; cargaHorariaSemanal: number | null;
    obrigatoria: boolean; turmas: number; naMatriz: boolean;
  }>;
  professores: Array<{ id: string; nome: string; turmas: number; disciplinas: number }>;
  alunos: {
    items: Array<{
      id: string; nome: string; turmaId: string; turmaNome: string;
      numeroChamada: number | null;
    }>;
    total: number; page: number; pageSize: number; hasMore: boolean;
  };
  limitado: boolean;
};

export class ClasseReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ClasseReadError";
  }
}

export function classeContextQueryKey(context: EntityContext, page: number) {
  return ["command-center", "classe", context.escolaId, context.id, context.academicYearId, page] as const;
}

export function classeContextHref(context: EntityContext, page: number) {
  const query = new URLSearchParams({ page: String(page) });
  if (context.academicYearId) query.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/classes/${encodeURIComponent(context.id)}?${query}`;
}

export function useClasseContext(context: EntityContext, page: number) {
  const query = useQuery({
    queryKey: classeContextQueryKey(context, page),
    queryFn: async ({ signal }) => {
      const response = await fetch(classeContextHref(context, page), {
        signal, cache: "no-store", credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null) as
        { ok?: boolean; data?: ClasseOverview; error?: string } | null;
      if (!response.ok || !payload?.ok || payload.data?.classe?.id !== context.id) {
        throw new ClasseReadError(
          payload?.error || "Não foi possível carregar a classe.", response.status,
        );
      }
      return payload.data;
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 && !(error instanceof ClasseReadError &&
      [400, 401, 403, 404, 409].includes(error.status)),
    refetchOnWindowFocus: false,
  });
  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Falha ao carregar a classe." : null,
    status: query.error instanceof ClasseReadError ? query.error.status : null,
    retry: query.refetch,
  };
}
