"use client";

import { useEffect, useState } from "react";
import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";

type KpiStats = { turmas: number; alunos: number; professores: number; avaliacoes: number };
type Aviso = { id: string; titulo: string; dataISO: string };
type Evento = { id: string; titulo: string; dataISO: string };
type PagamentosResumo = { pago: number; pendente: number; inadimplente: number };
type ChartsPayload = { meses: string[]; alunosPorMes: number[]; pagamentos: PagamentosResumo };

export default function EscolaAdminDashboardData({ escolaId }: { escolaId: string; escolaNome?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<KpiStats>({ turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 });
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [charts, setCharts] = useState<ChartsPayload | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/escolas/${escolaId}/admin/dashboard`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Falha ao carregar dashboard (${res.status})`);
        const data = await res.json();
        if (!data?.ok) throw new Error(data?.error || 'Resposta inválida');
        if (!mounted) return;
        setStats(data.kpis ?? stats);
        setAvisos(data.avisos ?? []);
        setEventos(data.eventos ?? []);
        setCharts(data.charts ?? undefined);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Erro ao carregar dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, [escolaId]);

  return (
    <EscolaAdminDashboardContent
      escolaId={escolaId}
      stats={stats}
      loading={loading}
      error={error}
      notices={avisos}
      events={eventos}
      charts={charts}
    />
  );
}
