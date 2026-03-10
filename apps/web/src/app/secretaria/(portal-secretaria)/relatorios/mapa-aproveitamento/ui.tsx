"use client";

import { useMemo, useState } from "react";
import { BarChart3, Filter } from "lucide-react";

type TurmaOption = { id: string; nome: string; codigo: string | null; turno: string | null };
type PeriodoOption = { id: string; numero: number | null; tipo: string | null };
type Coluna = { id: string; key: string; sigla: string; nome: string };
type Linha = {
  matricula_id: string;
  numero_processo: string | null;
  nome_aluno: string;
  notas: Record<string, number | null>;
  estatisticas: { media_geral: number | null; qtd_negativas: number; status: string };
};

type ApiData = {
  ok: boolean;
  error?: string;
  filtros?: { turmas: TurmaOption[]; periodos: PeriodoOption[] };
  report?: { colunas: Coluna[]; linhas: Linha[] } | null;
};

export default function MapaAproveitamentoClient() {
  const [turmaId, setTurmaId] = useState("");
  const [periodoId, setPeriodoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);

  const turmas = data?.filtros?.turmas ?? [];
  const periodos = data?.filtros?.periodos ?? [];
  const colunas = data?.report?.colunas ?? [];
  const linhas = data?.report?.linhas ?? [];

  const statusTone = useMemo(
    () => ({
      Reprovado: "bg-red-100 text-red-700",
      Recurso: "bg-amber-100 text-amber-700",
      Aprovado: "bg-emerald-100 text-emerald-700",
    }),
    []
  );

  async function carregar(incluirDados: boolean) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (incluirDados && turmaId) params.set("turma_id", turmaId);
    if (incluirDados && periodoId) params.set("periodo_letivo_id", periodoId);

    try {
      const res = await fetch(`/api/secretaria/relatorios/mapa-aproveitamento?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiData;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar mapa de aproveitamento.");
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      if (!data) setData({ ok: false, filtros: { turmas: [], periodos: [] }, report: null });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[#1F6B3B]">
          <BarChart3 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Mapa de Aproveitamento da Turma</h1>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Turma</label>
            <select
              value={turmaId}
              onFocus={() => {
                if (!data) void carregar(false);
              }}
              onChange={(e) => setTurmaId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            >
              <option value="">Selecione a turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome} {turma.codigo ? `(${turma.codigo})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Período letivo</label>
            <select
              value={periodoId}
              onFocus={() => {
                if (!data) void carregar(false);
              }}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            >
              <option value="">Todos</option>
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.numero ? `${periodo.numero}º` : "Período"} {periodo.tipo ? `• ${periodo.tipo}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={!turmaId || loading}
              onClick={() => void carregar(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Filter className="h-4 w-4" />
              {loading ? "A carregar..." : "Gerar mapa"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950 text-slate-200">
            <tr>
              <th className="px-3 py-2 text-left">Aluno</th>
              <th className="px-3 py-2 text-left">Processo</th>
              {colunas.map((coluna) => (
                <th key={coluna.key} className="px-3 py-2 text-center" title={coluna.nome}>
                  {coluna.sigla}
                </th>
              ))}
              <th className="px-3 py-2 text-center">Média</th>
              <th className="px-3 py-2 text-center">Negativas</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.matricula_id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">{linha.nome_aluno}</td>
                <td className="px-3 py-2 text-slate-600">{linha.numero_processo || "—"}</td>
                {colunas.map((coluna) => (
                  <td key={`${linha.matricula_id}-${coluna.key}`} className="px-3 py-2 text-center text-slate-700">
                    {typeof linha.notas?.[coluna.key] === "number" ? Number(linha.notas[coluna.key]).toFixed(1) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-medium text-slate-800">
                  {typeof linha.estatisticas.media_geral === "number" ? linha.estatisticas.media_geral.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2 text-center text-slate-700">{linha.estatisticas.qtd_negativas}</td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      statusTone[linha.estatisticas.status as keyof typeof statusTone] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {linha.estatisticas.status}
                  </span>
                </td>
              </tr>
            ))}
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={6 + colunas.length} className="px-3 py-8 text-center text-slate-500">
                  Selecione a turma e clique em "Gerar mapa" para visualizar o relatório.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
