"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PaymentDrawer } from "./PaymentDrawer";
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

export function FinanceiroPortalPage() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = studentId ? `?studentId=${studentId}` : "";
  const req = usePortalSWR({
    key: `financeiro-${studentId ?? "default"}`,
    url: `/api/aluno/financeiro${query}`,
    intervalMs: 30000,
    parse: (payload) => (((payload as ApiResponse).mensalidades ?? []).map((m) => ({ ...m, status: normalizeStatus(m.status) }))),
    onData: (data) => {
      setRows(data);
      setLoading(false);
    },
  });

  const sorted = useMemo(() => [...rows].sort((a, b) => b.competencia.localeCompare(a.competencia)), [rows]);

  const refresh = async () => {
    setRefreshing(true);
    await req.refresh();
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <button onClick={refresh} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600">
        {refreshing ? "A atualizar..." : "Puxar para atualizar"}
      </button>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Mensalidades</h2>
        {loading ? (
          <div className="mt-3 h-36 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <ul className="mt-3 space-y-2">
            {sorted.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.competencia}</p>
                  <p className="text-xs text-slate-500">{money.format(item.valor)}</p>
                </div>
                {item.status === "pago" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"><Check className="h-4 w-4" /> Pago</span>
                ) : item.status === "em_verificacao" ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Em Verificação</span>
                ) : (
                  <Button tone="gold" className="min-h-11" size="sm" onClick={() => setSelected(item)}><Wallet className="h-4 w-4" /> Pagar</Button>
                )}
              </li>
            ))}
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
