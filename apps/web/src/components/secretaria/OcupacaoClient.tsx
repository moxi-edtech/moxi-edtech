"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";

// Simplified types from the API response
type OcupacaoRow = {
  id: string;
  nome: string | null;
  sala: string | null;
  capacidade_maxima: number | null;
  total_matriculas_ativas: number | null;
  ocupacao_percentual: number | null;
  status_ocupacao: string | null;
};

type GrupoOcupacao = {
  classe: string | null;
  turno: string | null;
  capacidade_total: number;
  matriculas_ativas_total: number;
  ocupacao_media: number;
  turmas: OcupacaoRow[];
};

export default function OcupacaoClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ total_turmas: number; grupos: GrupoOcupacao[] } | null>(null);

  // Filters
  const [classeFilter, setClasseFilter] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        classe: classeFilter,
        turno: turnoFilter,
        status: statusFilter,
      });
      const res = await fetch(`/api/secretaria/turmas/ocupacao?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar dados de ocupação");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [classeFilter, turnoFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const distinctClasses = useMemo(() => {
    if (!data) return [];
    const classes = new Set(data.grupos.map(g => g.classe).filter(Boolean));
    return Array.from(classes);
  }, [data]);

  const distinctTurnos = useMemo(() => {
    if (!data) return [];
    const turnos = new Set(data.grupos.map(g => g.turno).filter(Boolean));
    return Array.from(turnos);
  }, [data]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-moxinexa-navy">Ocupação de Turmas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Análise da capacidade e matrículas ativas por turma.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-moxinexa-navy flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
                Filtros
            </h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select onChange={(e) => setClasseFilter(e.target.value)} value={classeFilter} className="border-gray-300 rounded-md shadow-sm">
            <option value="">Todas as Classes</option>
            {distinctClasses.map(c => <option key={c} value={c as string}>{c}</option>)}
          </select>
          <select onChange={(e) => setTurnoFilter(e.target.value)} value={turnoFilter} className="border-gray-300 rounded-md shadow-sm">
            <option value="">Todos os Turnos</option>
            {distinctTurnos.map(t => <option key={t} value={t as string}>{t}</option>)}
          </select>
          <select onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter} className="border-gray-300 rounded-md shadow-sm">
            <option value="">Todos os Status</option>
            <option value="ideal">Ideal</option>
            <option value="disponivel">Disponível</option>
            <option value="cheia">Cheia</option>
            <option value="superlotada">Superlotada</option>
          </select>
          <button onClick={loadData} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Aplicar Filtros
          </button>
        </div>
      </div>
      
      {loading && (
        <div className="text-center p-8">
          <div className="mx-auto space-y-2 max-w-xs">
            <Skeleton className="h-4 w-40 mx-auto" />
            <Skeleton className="h-3 w-56 mx-auto" />
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}

      {!loading && !error && data && (
        <div className="space-y-6">
          {data.grupos.map((grupo) => (
            <div key={`${grupo.classe}-${grupo.turno}`} className="bg-white rounded-xl shadow border p-5">
              <h2 className="text-xl font-semibold mb-4 text-moxinexa-navy">{grupo.classe} - {grupo.turno}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Turma</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Sala</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Capacidade</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Matrículas Ativas</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Ocupação</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grupo.turmas.map((turma) => (
                      <tr key={turma.id}>
                        <td className="px-4 py-4 text-slate-900 font-medium">{turma.nome}</td>
                        <td className="px-4 py-4 text-slate-600">{turma.sala ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-600">{turma.capacidade_maxima ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-600">{turma.total_matriculas_ativas ?? "0"}</td>
                        <td className="px-4 py-4 text-slate-600">{turma.ocupacao_percentual?.toFixed(1) ?? "0.0"}%</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            turma.status_ocupacao === 'superlotada' ? 'bg-red-100 text-red-700' :
                            turma.status_ocupacao === 'cheia' ? 'bg-amber-100 text-amber-700' :
                            turma.status_ocupacao === 'ideal' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {turma.status_ocupacao}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
