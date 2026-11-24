"use client";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dashboard } from "./Dashboard";
import ExpedienteDashboardCard from "@/components/secretaria/ExpedienteDashboardCard";
import DashboardSkeleton from "./DashboardSkeleton";
import type { DashboardCounts, DashboardRecentes, Plano } from "./types";

type SummaryResponse = {
  ok?: boolean;
  error?: string;
  counts?: DashboardCounts | null;
  recentes?: DashboardRecentes | null;
  escola?: {
    plano?: Plano | null;
  } | null;
};

const summaryRequests = new Map<string, Promise<SummaryResponse>>();

async function fetchDashboardSummary(escolaId?: string | null) {
  const key = escolaId || "default";
  const existing = summaryRequests.get(key);
  if (existing) return existing;

  const url = escolaId
    ? `/api/secretaria/dashboard/summary?escolaId=${encodeURIComponent(escolaId)}`
    : "/api/secretaria/dashboard/summary";
  const request = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      const body = (await res.json()) as SummaryResponse;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || "Falha ao carregar dados do dashboard");
      }
      return body;
    })
    .finally(() => summaryRequests.delete(key));

  summaryRequests.set(key, request);
  return request;
}

export default function SecretariaDashboardPage({ initialCounts = null, initialRecentes = null, escolaId = null }: {
  initialCounts?: DashboardCounts | null;
  initialRecentes?: DashboardRecentes | null;
  escolaId?: string | null;
}) {
  const [counts, setCounts] = useState<DashboardCounts | null>(initialCounts);
  const [recentes, setRecentes] = useState<DashboardRecentes | null>(initialRecentes);
  const hasInitialData = initialCounts !== null || initialRecentes !== null;
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (hasInitialData) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const summaryJson = await fetchDashboardSummary(escolaId);

        if (mounted) {
          setCounts(summaryJson.counts ?? null);
          setRecentes(summaryJson.recentes ?? null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Falha ao carregar dados do dashboard");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [hasInitialData, escolaId]);

  // Dados já vêm no SSR; recarrega discretamente ao regressar à aba
  // para que novos atendimentos apareçam sem F5 nem polling permanente.
  useEffect(() => {
    let active = true;
    let lastFetchedAt = Date.now();

    const refreshOnFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastFetchedAt < 15_000) return;
      lastFetchedAt = Date.now();
      void fetchDashboardSummary(escolaId)
        .then((summary) => {
          if (!active) return;
          setCounts(summary.counts ?? null);
          setRecentes(summary.recentes ?? null);
          setError(null);
        })
        .catch(() => {
          // Mantém os indicadores existentes em caso de falha de rede.
        });
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [escolaId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 flex justify-center">
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3"/>
          <h3 className="text-red-900 font-bold">Erro de Conexão</h3>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-card border border-red-200 rounded-lg text-sm font-bold text-red-700 hover:bg-red-50">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return <>{escolaId && <div className="px-4 pt-4 md:px-6"><ExpedienteDashboardCard escolaId={escolaId} portal="secretaria" /></div>}<Dashboard counts={counts} recentes={recentes} /></>;
}
