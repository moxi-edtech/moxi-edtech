"use client";

import { useEffect, useState } from "react";
import DashboardResumoCards from "./DashboardResumoCards";
import ProximaAulaCard from "./ProximaAulaCard";
import UltimasNotasCard from "./UltimasNotasCard";
import StatusFinanceiroCard from "./StatusFinanceiroCard";
import AvisosRecentesCard from "./AvisosRecentesCard";

type DashboardData = {
  ok: boolean;
  proxima_aula: any | null;
  ultima_nota: any | null;
  status_financeiro: { emDia: boolean; pendentes: number } | null;
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }>;
};

export default function DashboardLoader() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/aluno/dashboard", { cache: "force-cache" });
        const json = (await res.json()) as DashboardData;
        if (!res.ok || !json?.ok) throw new Error(json && (json as any).error ? (json as any).error : "Falha ao carregar dashboard");
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  if (loading) return <div>Carregando dashboard…</div>;
  if (error) return <div className="text-red-600">Erro: {error}</div>;

  return (
    <div className="space-y-6">
      <DashboardResumoCards>
        <ProximaAulaCard data={data?.proxima_aula ?? null} />
        <UltimasNotasCard data={data?.ultima_nota ?? null} />
        <StatusFinanceiroCard data={data?.status_financeiro ?? null} />
      </DashboardResumoCards>
      <AvisosRecentesCard items={data?.avisos_recentes ?? []} />
    </div>
  );
}
