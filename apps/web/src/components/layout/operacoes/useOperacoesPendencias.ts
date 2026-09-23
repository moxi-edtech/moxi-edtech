"use client";

import { useCallback, useEffect, useState } from "react";

type AulaResponse = { ok: boolean; items?: Array<{ status: string | null }>; summary?: Record<string, number> };
type CountResponse = { ok: boolean; items?: unknown[] };

export type OperacoesPendencias = {
  aulasAguardando: number;
  aulasAndamento: number;
  relatoriosRecebidos: number;
  planosRevisao: number;
  reaberturasNotas: number;
};

const EMPTY: OperacoesPendencias = {
  aulasAguardando: 0,
  aulasAndamento: 0,
  relatoriosRecebidos: 0,
  planosRevisao: 0,
  reaberturasNotas: 0,
};

const POLL_MS = 30_000;

export function todayInLuanda() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Contadores operacionais partilhados pela faixa de pendências e pelos modais.
 * Uma só fonte de polling: quem consome o hook não repete os pedidos.
 */
export function useOperacoesPendencias() {
  const [summary, setSummary] = useState<OperacoesPendencias>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const date = todayInLuanda();
      const [aulasRes, planosRes, reaberturasRes] = await Promise.all([
        fetch(`/api/secretaria/aulas?data=${date}`, { cache: "no-store" }),
        fetch("/api/secretaria/planos-aula", { cache: "no-store" }),
        fetch("/api/secretaria/notas/reabertura", { cache: "no-store" }),
      ]);
      const [aulas, planos, reaberturas] = await Promise.all([
        aulasRes.json() as Promise<AulaResponse>,
        planosRes.json() as Promise<CountResponse>,
        reaberturasRes.json() as Promise<CountResponse>,
      ]);
      if (!aulasRes.ok || !aulas.ok || !planosRes.ok || !planos.ok || !reaberturasRes.ok || !reaberturas.ok) {
        throw new Error("Não foi possível atualizar as pendências operacionais.");
      }
      const aulaSummary = aulas.summary ?? {};
      setSummary({
        aulasAguardando: aulaSummary.aguardando_confirmacao ?? 0,
        aulasAndamento: aulaSummary.em_andamento ?? 0,
        relatoriosRecebidos: aulaSummary.finalizada ?? 0,
        planosRevisao: planos.items?.length ?? 0,
        reaberturasNotas: reaberturas.items?.length ?? 0,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar as pendências operacionais.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return {
    summary,
    loading,
    refreshing,
    error,
    refresh: () => void load(),
  };
}
