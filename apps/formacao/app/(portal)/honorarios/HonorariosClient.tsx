"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { Wallet, Plus, Loader2, DollarSign, Calendar, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";

type Item = {
  id: string;
  referencia: string;
  cohort_id: string;
  formador_user_id: string;
  horas_ministradas: number;
  valor_hora: number;
  bonus: number;
  desconto: number;
  valor_liquido: number;
  competencia: string;
  status: "aberto" | "aprovado" | "pago" | "cancelado";
};

type Props = { role: string; userId: string };

export default function HonorariosClient({ role, userId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    cohort_id: "",
    formador_user_id: role === "formador" ? userId : "",
    horas_ministradas: "",
    valor_hora: "",
    bonus: "0",
    desconto: "0",
    competencia: "",
  });

  const totais = useMemo(() => {
    const total = items.reduce((acc, i) => acc + Number(i.valor_liquido), 0);
    const pagos = items.filter(i => i.status === 'pago').reduce((acc, i) => acc + Number(i.valor_liquido), 0);
    return { total, pagos, pendente: total - pagos };
  }, [items]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/honorarios", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Item[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar honorários");
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    const payload = {
      cohort_id: form.cohort_id,
      formador_user_id: role === "formador" || role === "mentor" ? userId : form.formador_user_id,
      horas_ministradas: Number(form.horas_ministradas),
      valor_hora: Number(form.valor_hora),
      bonus: Number(form.bonus || "0"),
      desconto: Number(form.desconto || "0"),
      competencia: form.competencia,
    };

    try {
      const res = await fetch("/api/formacao/honorarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar lançamento");

      toast({ title: "Sucesso!", description: "Lançamento de honorário realizado." });
      setForm({
        cohort_id: "",
        formador_user_id: role === "formador" || role === "mentor" ? userId : "",
        horas_ministradas: "",
        valor_hora: "",
        bonus: "0",
        desconto: "0",
        competencia: "",
      });
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const changeStatus = async (id: string, status: Item["status"]) => {
    try {
      const res = await fetch("/api/formacao/honorarios", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm("Deseja apagar este lançamento?")) return;
    try {
      const res = await fetch(`/api/formacao/honorarios?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao remover lançamento");
      toast({ title: "Removido", description: "O honorário foi apagado." });
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-12">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Wallet size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">financeiro</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Honorários</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Registe as tuas horas e acompanhe os teus pagamentos.
        </p>
      </header>

      {/* Resumo */}
      <section className="grid grid-cols-2 gap-3">
        <SummaryCard title="A Receber" value={totais.pendente} tone="warning" />
        <SummaryCard title="Já Pago" value={totais.pagos} tone="positive" />
      </section>

      {/* Formulário de Lançamento */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 px-2">Novo Lançamento</h2>
        <form onSubmit={createItem} className="space-y-4">
          <div className="grid gap-3">
            <input className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] font-semibold" value={form.cohort_id} onChange={(e) => setForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="ID da Turma" required />
            
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] font-semibold" value={form.horas_ministradas} onChange={(e) => setForm((p) => ({ ...p, horas_ministradas: e.target.value }))} placeholder="Horas" type="number" min={1} required />
              <input className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] font-semibold" value={form.valor_hora} onChange={(e) => setForm((p) => ({ ...p, valor_hora: e.target.value }))} placeholder="Valor/Hora" type="number" min={0} step="0.01" required />
            </div>

            <input className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] font-semibold" value={form.competencia} onChange={(e) => setForm((p) => ({ ...p, competencia: e.target.value }))} type="date" required />
          </div>

          <button type="submit" disabled={isCreating} className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#1F6B3B] text-white font-black text-sm shadow-xl shadow-[#1F6B3B]/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50">
            {isCreating ? <Loader2 size={20} className="animate-spin" /> : <><Plus size={18} /> Registar Honorário</>}
          </button>
        </form>
      </section>

      {/* Lista de Honorários */}
      <main className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 px-2">Histórico</h2>
        {loading ? (
          <div className="h-32 rounded-[2rem] bg-white animate-pulse border border-slate-100" />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="group bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                    <DollarSign size={24} />
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusPill(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-black text-slate-900 leading-tight">{item.referencia}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comp: {item.competencia}</p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <p className="text-lg font-black text-slate-900">{formatMoney(item.valor_liquido)}</p>
                  <button onClick={() => removeItem(item.id)} className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
            {items.length === 0 && (
              <div className="py-12 text-center rounded-[2rem] bg-white border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">Sem lançamentos.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string, value: number, tone: 'positive' | 'warning' }) {
  const tones = {
    positive: "bg-emerald-50 border-emerald-100 text-emerald-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
  };

  return (
    <article className={`rounded-3xl border p-6 ${tones[tone]} flex flex-col items-center text-center shadow-sm`}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
      <p className="mt-2 text-xl font-black">{formatMoney(value)}</p>
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function statusPill(status: Item["status"]) {
  if (status === "pago") return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (status === "aprovado") return "bg-amber-50 text-amber-600 border border-amber-100";
  if (status === "cancelado") return "bg-rose-50 text-rose-600 border border-rose-100";
  return "bg-slate-50 text-slate-500 border border-slate-100";
}
