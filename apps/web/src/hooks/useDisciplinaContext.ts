"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { normalizeDisciplinaSearch } from "@/lib/command-center/disciplina-explorer";

export type DisciplinaOverview = {
  disciplina: {
    id: string; nome: string; sigla: string | null; area: string | null;
    isCore: boolean | null; isAvaliavel: boolean | null;
    cargaHorariaReferencia: number | null;
  };
  anoLetivo: { id: string; ano: number; historico: boolean };
  stats: { professores: number; turmas: number; cursos: number; classes: number };
  unresolvedTeacherLinks: number;
  professores: Array<{ id: string; nome: string; turmas: number }>;
  turmas: Array<{
    id: string; nome: string; turno: string | null;
    classeNome: string | null; cursoNome: string | null;
    classeId: string | null; cursoId: string | null;
    vinculoTurma: boolean; horarioPublicado: boolean; docenteVinculado: boolean; docenteEmHorario: boolean;
    professores: Array<{ id: string; nome: string }>;
  }>;
  /** Published curriculum of the selected academic year. */
  curriculo: Array<{
    id: string; curriculoId: string; curriculoVersao: number;
    cursoId: string | null; cursoNome: string | null;
    classeId: string | null; classeNome: string | null;
    cargaHorariaSemanal: number | null; obrigatoria: boolean | null;
    ativo: boolean | null;
  }>;
  cobertura: Array<{
    curriculoId: string; matrizId: string;
    cursoId: string | null; classeId: string | null;
    turmasComVinculo: number; turmasComDocente: number; turmasComHorario: number;
  }>;
  limitado: boolean;
};

export type DisciplinaSearchItem = {
  id: string; type: "disciplina"; label: string;
  highlight: string | null; academicYearId: string;
};

export class DisciplinaReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DisciplinaReadError";
  }
}

const isPermanent = (error: unknown) => error instanceof DisciplinaReadError &&
  [400, 401, 403, 404, 409].includes(error.status);

export function disciplinaContextQueryKey(context: EntityContext) {
  return ["command-center", "disciplina", context.escolaId, context.id, context.academicYearId] as const;
}

export function disciplinaContextHref(context: EntityContext) {
  const query = new URLSearchParams();
  if (context.academicYearId) query.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
  return `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/disciplinas/${encodeURIComponent(context.id)}${query.size ? `?${query}` : ""}`;
}

async function fetchJSON<T>(href: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(href, {
    credentials: "same-origin", cache: "no-store", signal,
  });
  const reply = await response.json().catch(() => null) as {
    ok?: boolean; data?: T; items?: T; error?: string;
  } | null;
  if (!response.ok || !reply?.ok) throw new DisciplinaReadError(
    reply?.error || "Não foi possível carregar disciplinas.", response.status,
  );
  return (reply.data ?? reply.items) as T;
}

export function useDisciplinaContext(context: EntityContext) {
  const query = useQuery({
    queryKey: disciplinaContextQueryKey(context),
    queryFn: ({ signal }) => fetchJSON<DisciplinaOverview>(disciplinaContextHref(context), signal),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 && !isPermanent(error),
    refetchOnWindowFocus: false,
  });
  const data = query.data?.disciplina?.id === context.id ? query.data : undefined;
  return {
    data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Falha ao carregar." : null,
    status: query.error instanceof DisciplinaReadError ? query.error.status : null,
    retry: query.refetch,
  };
}

export function disciplinaSearchQueryKey(escolaId: string | null | undefined, yearId: string | null, query: string) {
  return ["command-center", "disciplina-search", escolaId ?? null, yearId, query] as const;
}

export function disciplinaSearchHref(escolaId: string, query: string, yearId: string | null) {
  const params = new URLSearchParams({ q: query });
  if (yearId) params.set(ACADEMIC_YEAR_PARAM, yearId);
  return `/api/escolas/${encodeURIComponent(escolaId)}/command-center/disciplinas?${params}`;
}

/** Independent authorized subject search until search_global_entities supports this type. */
export function useDisciplinaSearch(input: {
  escolaId: string | null | undefined;
  query: string;
  academicYearId: string | null;
  enabled: boolean;
}) {
  const normalized = normalizeDisciplinaSearch(input.query);
  const debounced = useDebounce(normalized, 300);
  const enabled = Boolean(input.enabled && input.escolaId && debounced.length >= 2);
  const result = useQuery({
    queryKey: disciplinaSearchQueryKey(input.escolaId, input.academicYearId, debounced),
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(disciplinaSearchHref(input.escolaId!, debounced, input.academicYearId), {
        credentials: "same-origin", cache: "no-store", signal,
      });
      const reply = await response.json().catch(() => null) as {
        ok?: boolean; error?: string; items?: DisciplinaSearchItem[];
      } | null;
      if (!response.ok || !reply?.ok || !Array.isArray(reply.items)) throw new DisciplinaReadError(
        reply?.error || "Pesquisa de disciplinas indisponível.", response.status,
      );
      return reply.items;
    },
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 && !isPermanent(error),
    refetchOnWindowFocus: false,
  });
  const matchesQuery = enabled && normalized === debounced;
  return {
    items: matchesQuery ? result.data ?? [] : [],
    loading: Boolean(input.enabled && normalized.length >= 2 &&
      (normalized !== debounced || result.isPending)),
    error: matchesQuery && result.error instanceof Error ? result.error.message : null,
    retry: result.refetch,
  };
}
