"use client";

import { useQuery } from "@tanstack/react-query";
import type { EntityContext } from "@/lib/command-center/entity-context";

export type FuncionarioOverview = {
  funcionario: {
    id: string;
    nome: string;
    papel: string;
  };
};

export class FuncionarioReadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FuncionarioReadError";
  }
}

export function funcionarioContextHref(context: EntityContext, poloId: string | null = null) {
  const base = `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/funcionarios/${encodeURIComponent(context.id)}`;
  // Server explicitly denies polo scopes until membership isolation is implemented.
  return poloId === null ? base : `${base}?polo_id=${encodeURIComponent(poloId)}`;
}

async function readFuncionario(context: EntityContext, poloId: string | null, signal: AbortSignal): Promise<FuncionarioOverview> {
  const response = await fetch(funcionarioContextHref(context, poloId), {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: FuncionarioOverview;
    error?: string;
  } | null;
  if (!response.ok || !payload?.ok || payload.data?.funcionario?.id !== context.id) {
    throw new FuncionarioReadError(payload?.error || "Não foi possível consultar o funcionário.", response.status);
  }
  return payload.data;
}

export function useFuncionarioContext(context: EntityContext) {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const poloId = params.has("polo_id") ? params.get("polo_id") : params.get("poloId");
  const query = useQuery({
    queryKey: ["command-center", "funcionario", context.escolaId, context.id, poloId],
    queryFn: ({ signal }) => readFuncionario(context, poloId, signal),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: (count, error) => count < 1 &&
      !(error instanceof FuncionarioReadError && [400, 401, 403, 404].includes(error.status)),
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Falha na consulta." : null,
    status: query.error instanceof FuncionarioReadError ? query.error.status : null,
    retry: query.refetch,
  };
}
