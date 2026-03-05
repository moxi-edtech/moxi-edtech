"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";

type StatusResponse = { nome: string; classe: string | null; turma: string | null; estadoAcademico: string } | null;
type FinanceResponse = { id: string; valor: number; mes: string | null } | null;
type GradeItem = { disciplina: string; tipo: string; nota: number | null; data: string | null };

export function TabHome() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);

  const [status, setStatus] = useState<StatusResponse>(null);
  const [alert, setAlert] = useState<FinanceResponse>(null);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingAlert, setLoadingAlert] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const query = studentId ? `?studentId=${studentId}` : "";

  const statusReq = usePortalSWR({
    key: `home-status-${studentId ?? "default"}`,
    url: `/api/aluno/home/status${query}`,
    intervalMs: 60000,
    parse: (payload) => (payload as { status?: StatusResponse }).status ?? null,
    onData: (data) => {
      setStatus(data);
      setLoadingStatus(false);
    },
  });

  const alertReq = usePortalSWR({
    key: `home-alert-${studentId ?? "default"}`,
    url: `/api/aluno/home/finance-alert${query}`,
    intervalMs: 45000,
    parse: (payload) => (payload as { alert?: FinanceResponse }).alert ?? null,
    onData: (data) => {
      setAlert(data);
      setLoadingAlert(false);
    },
  });

  const gradesReq = usePortalSWR({
    key: `home-grades-${studentId ?? "default"}`,
    url: `/api/aluno/home/recent-grades${query}`,
    intervalMs: 90000,
    parse: (payload) => ((payload as { items?: GradeItem[] }).items ?? []).slice(0, 3),
    onData: (data) => {
      setGrades(data);
      setLoadingGrades(false);
    },
  });

  const pullToRefresh = async () => {
    setRefreshing(true);
    await Promise.all([statusReq.refresh(), alertReq.refresh(), gradesReq.refresh()]);
    setRefreshing(false);
  };

  const notasValidas = grades.filter((item) => typeof item.nota === "number") as Array<
    GradeItem & { nota: number }
  >;
  const mediaNotas = notasValidas.length
    ? Number((notasValidas.reduce((sum, item) => sum + item.nota, 0) / notasValidas.length).toFixed(1))
    : null;

  const mediaColor = (valor: number | null) => {
    if (valor === null) return "text-slate-400";
    if (valor >= 14) return "text-klasse-green-600";
    if (valor >= 10) return "text-klasse-gold-600";
    return "text-rose-500";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resumo</p>
        <button
          onClick={pullToRefresh}
          className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm"
        >
          {refreshing ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ano lectivo</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {status?.nome ?? "Aluno"}
            </h2>
            <p className="text-sm text-slate-500">
              {status?.classe ?? "Classe —"} {status?.turma ? `• ${status.turma}` : ""}
            </p>
            {status?.estadoAcademico && (
              <span className="mt-3 inline-flex rounded-full bg-klasse-green-50 px-3 py-1 text-xs font-semibold text-klasse-green-700">
                {status.estadoAcademico}
              </span>
            )}
          </div>
          <div className="grid min-w-[180px] grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-400">Média</p>
              <p className={`text-lg font-semibold ${mediaColor(mediaNotas)}`}>
                {mediaNotas ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-400">Pendentes</p>
              <p className="text-lg font-semibold text-slate-900">{alert ? 1 : 0}</p>
            </div>
          </div>
        </div>
      </section>

      {loadingAlert ? (
        <div className="h-16 animate-pulse rounded-2xl bg-klasse-gold-100" />
      ) : alert ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Mensalidade em atraso</p>
            <p className="text-xs text-slate-500">
              {new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(alert.valor)}
              {alert.mes ? ` • ${alert.mes}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-klasse-gold-700">
            Consulte o financeiro
          </span>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Notas recentes</p>
          <span className="text-xs text-slate-400">Últimas avaliações</span>
        </div>
        {loadingGrades ? (
          <div className="mt-4 h-28 animate-pulse rounded-xl bg-slate-100" />
        ) : grades.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Sem avaliações recentes.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {grades.map((item, idx) => (
              <div key={`${item.disciplina}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.disciplina}</p>
                  <p className="text-xs text-slate-500">{item.tipo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{item.nota ?? "—"}</p>
                  <p className="text-xs text-slate-400">
                    {item.data ? new Date(item.data).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
