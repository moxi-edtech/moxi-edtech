"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw, Search, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type QueueItem = {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  numero_processo: string | null;
  reason_code: string;
  reason_detail: string | null;
  valor_cobrado: number;
  created_at: string;
  ano_letivo_id: string | null;
  turma_nome: string | null;
  turno: string | null;
  pagamento: { id: string; valor: number; status: string; created_at: string } | null;
};
type AcademicYear = { id: string; ano: number; ativo: boolean };

const reasonLabel: Record<string, string> = {
  REMATRICULA_RECONCILIATION_REQUIRED: "Pagamento recebido · matrícula por concluir",
  REMATRICULA_LEGACY_REVIEW_REQUIRED: "Pedido antigo · contexto incompleto",
};

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export default function RematriculaReconciliacaoPage() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const escolaId = String(params?.id ?? "");
  const [query, setQuery] = useState(searchParams?.get("q") ?? "");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [yearId, setYearId] = useState(searchParams?.get("ano_letivo_id") ?? "");
  const [years, setYears] = useState<AcademicYear[]>([]);

  const load = useCallback(async () => {
    if (!escolaId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ escolaId, limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (yearId) params.set("ano_letivo_id", yearId);
      const response = await fetch(`/api/secretaria/balcao/rematriculas/reconciliation-queue?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || `Erro ${response.status}`);
      setItems(body.items ?? []);
      setTotal(Number(body.total ?? 0));
      setYears(body.available_years ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, [escolaId, query, yearId]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const oldest = useMemo(() => {
    if (!items.length) return null;
    return new Date(items[0].created_at).toLocaleDateString("pt-AO");
  }, [items]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (query.trim()) next.set("q", query.trim()); else next.delete("q");
    if (yearId) next.set("ano_letivo_id", yearId); else next.delete("ano_letivo_id");
    router.replace(`?${next.toString()}`);
    setReloadKey((value) => value + 1);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-klasse-green">
              <WalletCards className="h-4 w-4" /> Rematrícula · Secretaria
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Pendências de reconciliação</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Pagamentos já recebidos que precisam de uma conclusão académica. Abra o Balcão para resolver — não cobre novamente.
            </p>
          </div>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-klasse-green hover:text-klasse-green">
            <RefreshCw className="h-4 w-4" /> Actualizar fila
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Pendências abertas</div><div className="mt-1 text-2xl font-bold text-amber-950">{total}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mais antiga nesta página</div><div className="mt-1 text-lg font-bold text-slate-900">{oldest ?? "—"}</div></div>
          <div className="rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-klasse-green">Regra operacional</div><div className="mt-1 text-sm font-semibold text-klasse-green-900">Sem nova cobrança</div></div>
        </div>

        <form onSubmit={submitSearch} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
          <label className="sr-only" htmlFor="reconciliation-search">Pesquisar aluno ou processo</label>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-klasse-gold focus-within:ring-4 focus-within:ring-klasse-gold/20">
            <Search className="h-4 w-4 text-slate-400" />
            <input id="reconciliation-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome ou número de processo" className="w-full py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
          </div>
          <select aria-label="Filtrar por ano letivo" value={yearId} onChange={(event) => { setYearId(event.target.value); setReloadKey((value) => value + 1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
            <option value="">Todos os anos</option>
            {years.map((year) => <option key={year.id} value={year.id}>{year.ano}{year.ativo ? " · activo" : ""}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-klasse-green px-4 py-2 text-sm font-semibold text-white hover:bg-klasse-green-700">Pesquisar</button>
        </form>

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {loading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">A carregar pendências…</div>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Aluno</th><th className="px-4 py-3">Pendência</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3 text-right">Acção</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-4"><div className="font-semibold text-slate-900">{item.aluno_nome}</div><div className="mt-0.5 text-xs text-slate-500">Proc. {item.numero_processo ?? "—"}</div></td>
                      <td className="px-4 py-4"><div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> {reasonLabel[item.reason_code] ?? "Revisão necessária"}</div><div className="mt-1 max-w-xs text-xs text-slate-500">{item.reason_detail ?? "Pagamento registado; falta concluir a operação."}</div></td>
                      <td className="px-4 py-4 text-slate-700">{item.turma_nome ?? "Turma por confirmar"}{item.turno ? <span className="block text-xs text-slate-500">{item.turno}</span> : null}</td>
                      <td className="px-4 py-4"><div className="font-semibold text-slate-900">{money.format(item.pagamento?.valor ?? item.valor_cobrado)}</div><div className="mt-0.5 flex items-center gap-1 text-xs text-klasse-green"><CheckCircle2 className="h-3.5 w-3.5" /> Recebido</div></td>
                      <td className="px-4 py-4 text-right"><Link href={`/escola/${escolaId}/secretaria/balcao?alunoId=${encodeURIComponent(item.aluno_id)}${item.ano_letivo_id ? `&ano_letivo_id=${encodeURIComponent(item.ano_letivo_id)}` : ""}`} className="inline-flex items-center gap-1.5 rounded-lg bg-klasse-green px-3 py-2 text-xs font-semibold text-white hover:bg-klasse-green-700">Abrir Balcão <ArrowRight className="h-3.5 w-3.5" /></Link></td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={5} className="px-4 py-12 text-center"><Clock3 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Nenhuma pendência aberta</p><p className="mt-1 text-sm text-slate-500">Os pagamentos de rematrícula estão sincronizados com as matrículas.</p></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
