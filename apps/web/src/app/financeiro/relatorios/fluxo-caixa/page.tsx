"use client";

import { useEffect, useState } from "react";

type Dia = {
  dia: string | null;
  qtdTotal: number;
  qtdPagos: number;
  pctPago: number;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dia[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/financeiro/relatorios/fluxo-caixa', { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Erro ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) setRows(j.series || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-moxinexa-navy">Fluxo de Caixa (diário)</h1>

      {loading && (
        <div className="p-4 bg-white rounded-xl shadow border text-gray-600">Carregando…</div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
          <table className="min-w-full text-sm align-middle">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Dia</th>
                <th className="py-2 pr-4 text-right">Pagos</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4">% Pago</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dia ?? Math.random()} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 whitespace-nowrap">{r.dia ? new Date(r.dia).toLocaleDateString() : '—'}</td>
                  <td className="py-2 pr-4 text-right">{r.qtdPagos}</td>
                  <td className="py-2 pr-4 text-right">{r.qtdTotal}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-40 bg-gray-100 rounded">
                        <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.min(100, Math.max(0, r.pctPago))}%` }} />
                      </div>
                      <span className="tabular-nums">{r.pctPago.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="py-4 text-gray-500" colSpan={4}>Sem movimentação.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

