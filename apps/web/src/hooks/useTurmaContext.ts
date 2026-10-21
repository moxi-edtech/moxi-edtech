"use client";

import { useQuery } from "@tanstack/react-query";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";

export type TurmaContextData = {
  turma: {
    id: string;
    nome: string;
    turno: string | null;
    sala: string | null;
    classe: { id: string; nome: string } | null;
    curso: { id: string; nome: string } | null;
    capacidade: number | null;
    anoLetivo: { id: string; ano: number; historico: boolean };
  };
  alunos: {
    items: Array<{ id: string; nome: string; numeroChamada: number | null }>;
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  disciplinas: Array<{ id: string; nome: string; professores: string[]; professoresDetalhes?: Array<{ id: string; nome: string }> }>;
  professores: string[];
  disciplinasLimitadas: boolean;
};

export class TurmaReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TurmaReadError";
  }
}

export function turmaContextQueryKey(context: EntityContext, page: number) {
  return ["command-center", "turma", context.escolaId, context.id, context.academicYearId, page] as const;
}

export function turmaContextHref(context: EntityContext, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (context.academicYearId) params.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/turmas/${encodeURIComponent(context.id)}?${params}`;
}

async function readTurma(context: EntityContext, page: number, signal: AbortSignal): Promise<TurmaContextData> {
  const response = await fetch(turmaContextHref(context, page), {
    credentials: "same-origin", cache: "no-store", signal,
  });
  const reply = (await response.json().catch(() => null)) as {
    ok?: boolean; data?: TurmaContextData; error?: string;
  } | null;
  if (!response.ok || !reply?.ok || !reply.data || reply.data.turma?.id !== context.id) {
    throw new TurmaReadError(reply?.error || "Não foi possível carregar a turma.", response.status);
  }
  return reply.data;
}

export function useTurmaContext(context: EntityContext, page: number) {
  const query = useQuery({
    queryKey: turmaContextQueryKey(context, page),
    queryFn: ({ signal }) => readTurma(context, page, signal),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 && !(error instanceof TurmaReadError && [400, 401, 403, 404, 409].includes(error.status)),
    refetchOnWindowFocus: false,
  });
  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Falha ao carregar a turma." : null,
    status: query.error instanceof TurmaReadError ? query.error.status : null,
    retry: query.refetch,
  };
}
