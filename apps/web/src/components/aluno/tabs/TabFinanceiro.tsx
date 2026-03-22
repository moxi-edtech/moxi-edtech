"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Filter, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PaymentDrawer } from "@/components/aluno/financeiro-portal/PaymentDrawer";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";

type Item = { id: string; competencia: string; valor: number; status: "pago" | "pendente" | "atrasado" | "em_verificacao" };
type ApiResponse = { ok: boolean; mensalidades: Array<Omit<Item, "status"> & { status: string }> };

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

function normalizeStatus(value: string): Item["status"] {
  if (value === "pago") return "pago";
  if (value === "em_verificacao") return "em_verificacao";
  if (value === "atrasado") return "atrasado";
  return "pendente";
}

export function TabFinanceiro() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fromAno, setFromAno] = useState(currentYear - 4);
  const [toAno, setToAno] = useState(currentYear);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 1; year >= currentYear - 12; year -= 1) list.push(year);
    return list;
  }, [currentYear]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    params.set("fromAno", String(fromAno));
    params.set("toAno", String(toAno));
    return `?${params.toString()}`;
  }, [studentId, fromAno, toAno]);

  const req = usePortalSWR({
    key: `financeiro-${studentId ?? "default"}-${fromAno}-${toAno}`,
    url: `/api/aluno/financeiro${query}`,
    intervalMs: 30000,
    parse: (payload) => (((payload as ApiResponse).mensalidades ?? []).map((m) => ({ ...m, status: normalizeStatus(m.status) }))),
    onData: (data) => {
      setRows(data);
      setLoading(false);
    },
  });

  const sorted = useMemo(() => [...rows].sort((a, b) => b.competencia.localeCompare(a.competencia)), [rows]);
  const totalPago = useMemo(() => rows.filter((r) => r.status === "pago").reduce((sum, r) => sum + r.valor, 0), [rows]);
  const totalPendente = useMemo(
    () => rows.filter((r) => r.status === "pendente" || r.status === "atrasado").reduce((sum, r) => sum + r.valor, 0),
    [rows]
  );

  const refresh = async () => {
    setRefreshing(true);
    await req.refresh();
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Financeiro</p>
        <button
          onClick={refresh}
          className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm"
        >
          {refreshing ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="fromAno" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">De</label>
            <select
              id="fromAno"
              value={fromAno}
              onChange={(e) => setFromAno(Number(e.target.value))}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
            >
              {years.map((year) => (
                <option key={`from-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="toAno" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Até</label>
            <select
              id="toAno"
              value={toAno}
              onChange={(e) => setToAno(Number(e.target.value))}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
            >
              {years.map((year) => (
                <option key={`to-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <Button tone="gray" size="sm" className="min-h-10" onClick={refresh}>
            <Filter className="h-4 w-4" /> Aplicar filtro
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pago</p>
          <p className="mt-2 text-lg font-semibold text-klasse-green-700">{money.format(totalPago)}</p>
        </div>
        <div className="rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-klasse-gold-700">Pendente</p>
          <p className="mt-2 text-lg font-semibold text-klasse-gold-800">{money.format(totalPendente)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Mensalidades</h2>
        {loading ? (
          <div className="mt-3 h-28 sm:h-36 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <ul className="mt-3 space-y-2">
            {sorted.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.competencia}</p>
                  <p className="text-xs text-slate-500">{money.format(item.valor)}</p>
                </div>
                {item.status === "pago" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-klasse-green-50 px-3 py-1 text-xs font-medium text-klasse-green-700">
                    <Check className="h-4 w-4" /> Pago
                  </span>
                ) : item.status === "em_verificacao" ? (
                  <span className="rounded-full bg-klasse-gold-100 px-3 py-1 text-xs font-medium text-klasse-gold-700">
                    Em Verificação
                  </span>
                ) : (
                  <Button tone="gold" className="min-h-11" size="sm" onClick={() => setSelected(item)}>
                    <Wallet className="h-4 w-4" /> Pagar
                  </Button>
                )}
              </li>
            ))}
            {!sorted.length ? <li className="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Sem mensalidades no intervalo selecionado.</li> : null}
          </ul>
        )}
      </section>

      <PaymentDrawer
        open={Boolean(selected)}
        mensalidade={selected}
        onClose={() => setSelected(null)}
        onUploaded={(id) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "em_verificacao" } : r)))}
        studentId={studentId}
      />
    </div>
  );
}
