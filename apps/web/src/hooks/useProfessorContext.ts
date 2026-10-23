"use client";

import { useQuery } from "@tanstack/react-query";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";

export type ProfessorOverview = {
  professor: { id: string; nome: string };
  anoLetivo: { id: string; ano: number; historico: boolean };
  stats: { turmas: number; disciplinas: number; aulasPublicadas: number };
  turmas: Array<{
    id: string; nome: string; turno: string | null;
    classeNome: string | null; cursoNome: string | null;
    disciplinas: Array<{ id: string; nome: string }>;
  }>;
  disciplinas: Array<{ id: string; nome: string; turmas: number }>;
  atribuicoes: Array<{
    turmaId: string; turmaNome: string;
    cursoNome: string | null; classeNome: string | null;
    disciplinaId: string; disciplinaNome: string;
    evidencia: "atribuicao_registada";
  }>;
  unresolvedDisciplineLinks: number;
  horarios: Array<{
    turmaId: string; turmaNome: string; disciplinaNome: string | null;
    diaSemana: number; inicio: string; fim: string;
  }>;
  limitado: boolean;
};

export class ProfessorReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProfessorReadError";
  }
}

export function professorContextQueryKey(context: EntityContext) {
  return ["command-center", "professor", context.escolaId, context.id, context.academicYearId] as const;
}

export function professorContextHref(context: EntityContext) {
  const query = new URLSearchParams();
  if (context.academicYearId) query.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  const suffix = query.size ? `?${query.toString()}` : "";
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/professores/${encodeURIComponent(context.id)}${suffix}`;
}

async function readProfessor(context: EntityContext, signal: AbortSignal): Promise<ProfessorOverview> {
  const response = await fetch(professorContextHref(context), {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const reply = (await response.json().catch(() => null)) as {
    ok?: boolean; data?: ProfessorOverview; error?: string;
  } | null;
  if (!response.ok || !reply?.ok || !reply.data || reply.data.professor?.id !== context.id) {
    throw new ProfessorReadError(reply?.error || "Não foi possível carregar o professor.", response.status);
  }
  return reply.data;
}

export function useProfessorContext(context: EntityContext) {
  const query = useQuery({
    queryKey: professorContextQueryKey(context),
    queryFn: ({ signal }) => readProfessor(context, signal),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 &&
      !(error instanceof ProfessorReadError && [400, 401, 403, 404, 409].includes(error.status)),
    refetchOnWindowFocus: false,
  });
  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Falha ao carregar o professor." : null,
    status: query.error instanceof ProfessorReadError ? query.error.status : null,
    retry: query.refetch,
  };
}
