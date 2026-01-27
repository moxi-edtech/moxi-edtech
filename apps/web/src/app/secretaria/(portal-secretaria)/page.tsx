"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { DashboardSkeleton } from "./DashboardSkeleton";
import type { DashboardCounts, DashboardRecentes, Plano } from "./types";

export default function SecretariaDashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [recentes, setRecentes] = useState<DashboardRecentes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [plan] = useState<Plano>('profissional');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [countsRes, recentesRes] = await Promise.all([
          fetch('/api/secretaria/dashboard', { cache: 'no-store' }),
          fetch('/api/secretaria/dashboard/recentes', { cache: 'no-store' }),
        ]);

        const countsJson = await countsRes.json();
        const recentesJson = await recentesRes.json();

        if (mounted) {
          if (!countsRes.ok || !countsJson?.ok) {
            throw new Error(countsJson?.error || 'Falha ao carregar dados do dashboard');
          }
          setCounts(countsJson.counts);

          if (recentesRes.ok && recentesJson?.ok) {
            setRecentes(recentesJson);
          }
        }
      } catch (e: any) {
        if (mounted) setError(e.message);
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

  return <Dashboard counts={counts} recentes={recentes} plan={plan} />;
}
