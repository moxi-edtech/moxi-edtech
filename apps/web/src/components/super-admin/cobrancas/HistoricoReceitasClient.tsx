"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type HistoricoRow = {
  id: string;
  escola_id: string;
  escola_nome: string;
  plano: string | null;
  ciclo: string | null;
  valor_kz: number;
  status: 'pendente' | 'confirmado' | 'falhado';
  metodo: string;
  referencia: string | null;
  data_evento: string;
  actor_id: string | null;
  actor_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
};

type PaginationPayload = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

const STATUSES = [
  { label: 'Todos os status', value: '' },
  { label: 'Pendente', value: 'pendente' },
  { label: 'Confirmado', value: 'confirmado' },
  { label: 'Falhado', value: 'falhado' },
];

export default function HistoricoReceitasClient() {
  const [items, setItems] = useState<HistoricoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState('');
  const [status, setStatus] = useState('');
  const [escola, setEscola] = useState('');

  const [pagination, setPagination] = useState<PaginationPayload>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 1,
  });

  const escolas = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.escola_id, item.escola_nome);
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [items]);

  const buildQueryString = useCallback(
    (pageValue: number, formatType: 'json' | 'csv' = 'json') => {
      const params = new URLSearchParams();
      params.set('page', String(pageValue));
      params.set('page_size', String(pagination.page_size));
      params.set('format', formatType);
      if (periodo) params.set('periodo', periodo);
      if (status) params.set('status', status);
      if (escola) params.set('escola_id', escola);
      return params.toString();
    },
    [pagination.page_size, periodo, status, escola],
  );

  const loadData = useCallback(
    async (pageValue = 1) => {
      try {
        setLoading(true);
        const query = buildQueryString(pageValue);
        const res = await fetch(`/api/super-admin/billing/historico?${query}`);
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'Falha ao carregar histórico de receitas');
        }

        setItems(json.items || []);
        setPagination(json.pagination || { page: 1, page_size: 20, total: 0, total_pages: 1 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString],
  );

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const query = buildQueryString(1, 'csv');
      const res = await fetch(`/api/super-admin/billing/historico?${query}`);
      if (!res.ok) {
        const fallback = await res.json().catch(() => ({}));
        throw new Error((fallback as { error?: string }).error || 'Não foi possível exportar o CSV');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historico-receitas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleAdjustStatus = async (item: HistoricoRow) => {
    const nextStatus = item.status === 'confirmado' ? 'pendente' : 'confirmado';
    try {
      setAdjustingId(item.id);
      const res = await fetch('/api/super-admin/billing/historico', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Falha ao aplicar ajuste');
      }

      toast.success('Ajuste aplicado e auditado com sucesso.');
      await loadData(pagination.page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setAdjustingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-semibold">Período (mês)</span>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-semibold">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-semibold">Escola</span>
            <select
              value={escola}
              onChange={(e) => setEscola(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todas as escolas</option>
              {escolas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              onClick={() => loadData(1)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600"
            >
              Filtrar
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase text-emerald-700 disabled:opacity-50"
            >
              {exportingCsv ? 'A exportar...' : 'Exportar CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3">Plano / Ciclo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={9}>
                    A carregar histórico...
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={9}>
                    Nenhum evento encontrado para os filtros seleccionados.
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.escola_nome}</td>
                    <td className="px-4 py-3 text-slate-600">{item.plano || '—'} / {item.ciclo || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">Kz {item.valor_kz.toLocaleString()}</td>
                    <td className="px-4 py-3 uppercase text-slate-700">{item.status}</td>
                    <td className="px-4 py-3 text-slate-700">{item.metodo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.referencia || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(item.data_evento), 'dd/MM/yyyy HH:mm')}</td>
                    <td className="px-4 py-3 text-slate-600">{item.actor_nome}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAdjustStatus(item)}
                        disabled={adjustingId === item.id}
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700 disabled:opacity-50"
                      >
                        {adjustingId === item.id ? 'Ajustando...' : 'Alternar status'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <p>
            Página {pagination.page} de {pagination.total_pages} — {pagination.total} registos
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => loadData(Math.max(pagination.page - 1, 1))}
              disabled={pagination.page <= 1 || loading}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => loadData(Math.min(pagination.page + 1, pagination.total_pages))}
              disabled={pagination.page >= pagination.total_pages || loading}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
