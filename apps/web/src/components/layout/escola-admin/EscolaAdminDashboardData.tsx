"use client";

import { useEffect, useState } from "react";
import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";
import type { KpiStats } from "./KpiSection";

// ... (teus types existentes)

export default function EscolaAdminDashboardData({ escolaId }: { escolaId: string; escolaNome?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null); // Armazena tudo
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/escolas/${escolaId}/admin/dashboard`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha na API');
        const json = await res.json();
        
        if (mounted) {
            // Assumindo que a tua API retorna algo como { avisos, eventos, charts, kpis }
            // Se a tua API atual não retorna 'kpis' diretos com contagens totais, 
            // precisas adicionar isso ao endpoint ou calcular aqui.
            // Vou simular mapeamento:
            setData({
                ...json,
                kpis: { // Mapeia o que vier da API para o formato KpiStats
                    turmas: json.charts?.turmasCount || 0, // Ajusta conforme tua API
                    alunos: json.charts?.alunosTotal || 0,
                    professores: json.charts?.professoresCount || 0,
                    avaliacoes: 0
                }
            });
        }
      } catch (e: any) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, [escolaId]);

  // Fallback stats se a API falhar ou estiver loading
  const stats: KpiStats = data?.kpis || { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 };

  return (
    <EscolaAdminDashboardContent
      escolaId={escolaId}
      loading={loading}
      error={error}
      stats={stats} // <--- O IMPORTANTE ESTÁ AQUI
      pagamentosKpis={data?.charts?.pagamentos}
      notices={data?.avisos}
      events={data?.eventos}
      charts={data?.charts}
    />
  );
}
