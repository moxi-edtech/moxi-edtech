"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardResumoCards from "./DashboardResumoCards";
import ProximaAulaCard from "./ProximaAulaCard";
import UltimasNotasCard from "./UltimasNotasCard";
import StatusFinanceiroCard from "./StatusFinanceiroCard";
import AvisosRecentesCard from "./AvisosRecentesCard";
import {
  BoletimAluno,
  EmptyState,
  ErrorState,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/feedback/FeedbackSystem";

type DashboardData = {
  ok: boolean;
  proxima_aula: any | null;
  ultima_nota: any | null;
  status_financeiro: { emDia: boolean; pendentes: number } | null;
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }>;
};

type BoletimData = {
  ok: boolean;
  nome_aluno?: string | null;
  trimestre_atual?: number | null;
  disciplinas: Array<{
    id: string;
    nome: string;
    nota_t1?: number | null;
    nota_t2?: number | null;
    nota_t3?: number | null;
    nota_final?: number | null;
    faltas: number;
    faltas_max: number;
    status: "lancada" | "pendente" | "bloqueada";
  }>;
};

export default function DashboardLoader() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [boletim, setBoletim] = useState<BoletimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardRes, boletimRes] = await Promise.all([
        fetch("/api/aluno/dashboard", { cache: "no-store", signal }),
        fetch("/api/aluno/boletim", { cache: "no-store", signal }),
      ]);
      const dashboardJson = (await dashboardRes.json()) as DashboardData;
      const boletimJson = (await boletimRes.json()) as BoletimData;
      if (!dashboardRes.ok || !dashboardJson?.ok) {
        throw new Error(
          dashboardJson && (dashboardJson as any).error
            ? (dashboardJson as any).error
            : "Falha ao carregar dashboard"
        );
      }
      setData(dashboardJson);
      if (boletimRes.ok && boletimJson?.ok) {
        setBoletim(boletimJson);
      }
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <StatCardsSkeleton count={3} />
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">Avisos recentes</p>
          </div>
          <TableSkeleton rows={3} cols={3} />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar"
        description={error}
        onRetry={() => loadDashboard()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardResumoCards>
        <ProximaAulaCard data={data?.proxima_aula ?? null} />
        <UltimasNotasCard data={data?.ultima_nota ?? null} />
        <StatusFinanceiroCard data={data?.status_financeiro ?? null} />
      </DashboardResumoCards>
      {boletim?.disciplinas?.length ? (
        <BoletimAluno
          disciplinas={boletim.disciplinas}
          trimestre={(boletim.trimestre_atual ?? 1) as 1 | 2 | 3}
          nomeAluno={boletim.nome_aluno ?? undefined}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            title="Sem boletim disponível"
            description="Assim que as notas forem lançadas, o boletim aparece aqui."
          />
        </div>
      )}
      <AvisosRecentesCard items={data?.avisos_recentes ?? []} />
    </div>
  );
}
