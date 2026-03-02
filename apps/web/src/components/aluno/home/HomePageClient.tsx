"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FinanceAlertBanner } from "./FinanceAlertBanner";
import { RecentGradesCard } from "./RecentGradesCard";
import { StudentStatusCard } from "./StudentStatusCard";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";

type StatusResponse = { nome: string; classe: string | null; turma: string | null; estadoAcademico: string } | null;
type FinanceResponse = { id: string; valor: number; mes: string | null } | null;
type GradeItem = { disciplina: string; tipo: string; nota: number | null; data: string | null };

export function HomePageClient() {
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

  return (
    <div className="space-y-4">
      <button onClick={pullToRefresh} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600">
        {refreshing ? "A atualizar..." : "Puxar para atualizar"}
      </button>

      <FinanceAlertBanner loading={loadingAlert} alert={alert} />
      <StudentStatusCard loading={loadingStatus} nome={status?.nome} classe={status?.classe} turma={status?.turma} estadoAcademico={status?.estadoAcademico} />
      <RecentGradesCard loading={loadingGrades} items={grades} />
    </div>
  );
}
