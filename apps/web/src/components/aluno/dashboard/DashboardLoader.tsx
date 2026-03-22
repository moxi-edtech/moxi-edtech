"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AvisosRecentesCard from "./AvisosRecentesCard";
import { ErrorState, StatCardsSkeleton, TableSkeleton } from "@/components/feedback/FeedbackSystem";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { NotaBar } from "@/components/aluno/shared/NotaBar";
import { Pill } from "@/components/aluno/shared/Pill";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";

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

  const notasRecentes = useMemo(() => {
    const disciplinas = boletim?.disciplinas ?? [];
    return disciplinas
      .map((disc) => {
        const nota = disc.nota_final ?? disc.nota_t3 ?? disc.nota_t2 ?? disc.nota_t1 ?? null;
        return { disciplina: disc.nome, nota };
      })
      .filter((item) => typeof item.nota === "number")
      .slice(0, 3) as Array<{ disciplina: string; nota: number }>;
  }, [boletim]);

  const pendentes = data?.status_financeiro?.pendentes ?? 0;
  const ultimaNota = data?.ultima_nota?.valor ?? null;
  const nomeAluno = boletim?.nome_aluno ?? "Aluno";

  const notaColor = (nota: number | null) => {
    if (nota === null) return "text-slate-400";
    if (nota >= 14) return "text-klasse-green-600";
    if (nota >= 10) return "text-klasse-gold-600";
    return "text-rose-500";
  };

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
      <div className="space-y-4 sm:space-y-6">
        <AlunoCard className="bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] text-white border-[#1f4028]">
          <div className="h-3 w-32 rounded-full bg-white/20" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="h-5 sm:h-6 w-44 rounded-full bg-white/20" />
              <div className="flex flex-wrap gap-2">
                <div className="h-5 sm:h-6 w-24 rounded-full bg-white/20" />
                <div className="h-5 sm:h-6 w-28 rounded-full bg-white/20" />
                <div className="h-5 sm:h-6 w-28 rounded-full bg-white/20" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                  <div className="h-3 w-20 rounded-full bg-white/20 mx-auto" />
                  <div className="mt-2 h-4 sm:h-5 w-12 rounded-full bg-white/20 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </AlunoCard>

        <div className="space-y-3">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <AlunoCard key={idx}>
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded-full bg-slate-200" />
                  <div className="h-4 w-10 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200" />
              </AlunoCard>
            ))}
          </div>
        </div>

        <AlunoCard>
          <div className="h-4 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 flex gap-3">
            <div className="h-4 w-32 rounded-full bg-slate-200" />
            <div className="h-4 w-20 rounded-full bg-slate-200" />
          </div>
        </AlunoCard>

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
      <AlunoCard className="bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] text-white border-[#1f4028]">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Ano lectivo</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">{nomeAluno}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill label={`Trimestre ${boletim?.trimestre_atual ?? "—"}`} />
              <Pill label={pendentes > 0 ? "Com pendências" : "Em dia"} colorClass="text-slate-900" bgClass="bg-white/70" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-50/70">Última nota</p>
              <p className={`text-lg font-semibold ${notaColor(ultimaNota)} text-white`}>{ultimaNota ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-50/70">Pendentes</p>
              <p className="text-lg font-semibold text-white">{pendentes}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-50/70">Próxima aula</p>
              <p className="text-lg font-semibold text-white">
                {data?.proxima_aula?.weekday != null ? `Dia ${data.proxima_aula.weekday}` : "—"}
              </p>
            </div>
          </div>
        </div>
      </AlunoCard>

      {pendentes > 0 && (
        <AlunoCard className="border-klasse-gold-200 bg-klasse-gold-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Mensalidades pendentes</p>
              <p className="text-xs text-slate-500">Há {pendentes} mensalidade(s) por regularizar.</p>
            </div>
            <Pill label="Ver financeiro" colorClass="text-klasse-gold-700" bgClass="bg-white" />
          </div>
        </AlunoCard>
      )}

      <div className="space-y-3">
        <SectionTitle action="Ver todas">Notas recentes</SectionTitle>
        {notasRecentes.length === 0 ? (
          <AlunoCard>
            <p className="text-sm text-slate-500">Sem notas recentes.</p>
          </AlunoCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {notasRecentes.map((nota) => (
              <AlunoCard key={nota.disciplina}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{nota.disciplina}</p>
                  <span className={`text-sm font-semibold ${notaColor(nota.nota)}`}>{nota.nota}</span>
                </div>
                <div className="mt-3">
                  <NotaBar nota={nota.nota} max={20} color="#16a34a" />
                </div>
              </AlunoCard>
            ))}
          </div>
        )}
      </div>

      <AlunoCard>
        <SectionTitle>Próxima aula</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span>
            {data?.proxima_aula?.inicio && data?.proxima_aula?.fim
              ? `${data.proxima_aula.inicio}–${data.proxima_aula.fim}`
              : "Horário indisponível"}
          </span>
          {data?.proxima_aula?.sala && <span>Sala {data.proxima_aula.sala}</span>}
        </div>
      </AlunoCard>

      <AvisosRecentesCard items={data?.avisos_recentes ?? []} />
    </div>
  );
}
