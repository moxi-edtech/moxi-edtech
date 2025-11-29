"use client";

import { useEffect, useState } from "react";

type Mensal = {
  anoLetivo: number;
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  totalPrevisto: number;
  totalPago: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type PorTurma = {
  turmaId: string;
  turmaNome: string;
  classe: string | null;
  turno: string | null;
  anoLetivo: number;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  totalPrevisto: number;
  totalPago: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mensal, setMensal] = useState<Mensal[]>([]);
  const [porTurma, setPorTurma] = useState<PorTurma[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/financeiro/relatorios/propinas?ano=${encodeURIComponent(ano)}`, { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Erro ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) {
          setMensal(j.mensal || []);
          setPorTurma(j.porTurma || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; }
  }, [ano]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy">Relatório de Propinas</h1>
          <p className="text-sm text-gray-600">Resumo mensal e ranking por turma</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600">Ano letivo</label>
          <input
            type="number"
            className="w-28 border rounded px-2 py-1"
            value={ano}
            onChange={(e) => setAno(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))}
          />
        </div>
      </div>

      {loading && (
        <div className="p-4 bg-white rounded-xl shadow border text-gray-600">Carregando…</div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
            <h2 className="text-base font-semibold mb-3">Série mensal</h2>
            <table className="min-w-full text-sm align-middle">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Competência</th>
                  <th className="py-2 pr-4 text-right">Previsto</th>
                  <th className="py-2 pr-4 text-right">Pago</th>
                  <th className="py-2 pr-4 text-right">Em atraso</th>
                  <th className="py-2 pr-4 text-right">Inadimplência %</th>
                </tr>
              </thead>
              <tbody>
                {mensal.map((m) => (
                  <tr key={`${m.ano}-${m.mes}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{m.labelMes}</td>
                    <td className="py-2 pr-4 text-right">{m.totalPrevisto.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.totalPago.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.totalEmAtraso.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.inadimplenciaPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {mensal.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={5}>Sem dados.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
            <h2 className="text-base font-semibold mb-3">Ranking por turma</h2>
            <table className="min-w-full text-sm align-middle">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Turma</th>
                  <th className="py-2 pr-4">Classe</th>
                  <th className="py-2 pr-4">Turno</th>
                  <th className="py-2 pr-4 text-right">Mensalidades</th>
                  <th className="py-2 pr-4 text-right">Em atraso</th>
                  <th className="py-2 pr-4 text-right">Total atraso</th>
                  <th className="py-2 pr-4 text-right">Inadimplência %</th>
                </tr>
              </thead>
              <tbody>
                {porTurma.map((t) => (
                  <tr key={t.turmaId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{t.turmaNome}</td>
                    <td className="py-2 pr-4">{t.classe || '—'}</td>
                    <td className="py-2 pr-4">{t.turno || '—'}</td>
                    <td className="py-2 pr-4 text-right">{t.qtdMensalidades}</td>
                    <td className="py-2 pr-4 text-right">{t.qtdEmAtraso}</td>
                    <td className="py-2 pr-4 text-right">{t.totalEmAtraso.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{t.inadimplenciaPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {porTurma.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={7}>Sem dados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

