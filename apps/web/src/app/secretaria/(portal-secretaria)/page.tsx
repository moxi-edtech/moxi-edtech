"use client";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dashboard } from "./Dashboard";
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

let summaryRequest: Promise<SummaryResponse> | null = null;

async function fetchDashboardSummary() {
  if (!summaryRequest) {
    summaryRequest = fetch("/api/secretaria/dashboard/summary", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as SummaryResponse;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error || "Falha ao carregar dados do dashboard");
        }
        return body;
      })
      .finally(() => {
        summaryRequest = null;
      });
  }

  return summaryRequest;
}

export default function SecretariaDashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [recentes, setRecentes] = useState<DashboardRecentes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const summaryJson = await fetchDashboardSummary();

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
  }, []);

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
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-700 hover:bg-red-50">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard counts={counts} recentes={recentes} />;
}
