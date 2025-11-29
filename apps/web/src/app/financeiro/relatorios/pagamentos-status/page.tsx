"use client";

import { useEffect, useState } from "react";

type Item = {
  status: string;
  total: number;
  pct: number;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/financeiro/relatorios/pagamentos-status', { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Erro ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) {
          setItems(j.items || []);
          setTotal(j.total || 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const colors: Record<string, string> = {
    pago: 'bg-green-500',
    pendente: 'bg-amber-500',
    atrasado: 'bg-rose-500',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-moxinexa-navy">Pagamentos por Status</h1>

      {loading && (
        <div className="p-4 bg-white rounded-xl shadow border text-gray-600">Carregando…</div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
          <div className="text-sm text-gray-600 mb-3">Total de registros: {total}</div>
          <table className="min-w-full text-sm align-middle">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 pr-4">% do total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.status} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 capitalize">{it.status}</td>
                  <td className="py-2 pr-4 text-right">{it.total}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-40 bg-gray-100 rounded">
                        <div className={`h-2 rounded ${colors[it.status] || 'bg-slate-500'}`} style={{ width: `${Math.min(100, Math.max(0, it.pct))}%` }} />
                      </div>
                      <span className="tabular-nums">{it.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="py-4 text-gray-500" colSpan={3}>Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

