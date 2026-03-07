"use client";

import { useEffect, useState } from "react";

type LimitesPlano = {
  max_alunos: number | null;
};

type MetricasAcessoResponse = {
  ok?: boolean;
  data?: {
    acesso_liberado?: number | null;
  };
  error?: string | null;
};

type PlanoResponse = {
  limites?: LimitesPlano | null;
  error?: string | null;
};

export function useLimitesPlano(escolaId: string | null) {
  const [licencasTotais, setLicencasTotais] = useState<number | null>(null);
  const [licencasUsadas, setLicencasUsadas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [planoRes, metricasRes] = await Promise.all([
          fetch(`/api/escolas/${escolaId}/plano`),
          fetch(`/api/secretaria/alunos/metricas-acesso?escolaId=${encodeURIComponent(escolaId)}`),
        ]);

        const planoJson = (await planoRes.json().catch(() => ({}))) as PlanoResponse;
        const metricasJson = (await metricasRes.json().catch(() => ({}))) as MetricasAcessoResponse;

        if (!planoRes.ok) {
          throw new Error(planoJson.error || "Falha ao carregar limites do plano.");
        }

        if (!metricasRes.ok || metricasJson.ok === false) {
          throw new Error(metricasJson.error || "Falha ao carregar métricas de acesso.");
        }

        if (active) {
          setLicencasTotais(planoJson.limites?.max_alunos ?? null);
          setLicencasUsadas(Number(metricasJson.data?.acesso_liberado ?? 0));
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar limites.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [escolaId]);

  return { licencasTotais, licencasUsadas, loading, error };
}
