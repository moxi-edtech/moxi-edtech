"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Estado = "pendente" | "em_analise" | "deferido" | "indeferido" | "expirado" | "cancelado";

type Pedido = {
  id: string;
  protocolo_publico: string;
  estado: Estado;
  motivo: string;
  nota_referencia: number | null;
  prazo_em: string;
  created_at: string;
  matricula_id: string;
  turma_id: string;
  disciplina_id: string;
  decisao_motivo: string | null;
};

const labels: Record<Estado, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  deferido: "Deferido",
  indeferido: "Indeferido",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

const badge: Record<Estado, string> = {
  pendente: "bg-amber-50 text-amber-700",
  em_analise: "bg-blue-50 text-blue-700",
  deferido: "bg-emerald-50 text-emerald-700",
  indeferido: "bg-rose-50 text-rose-700",
  expirado: "bg-slate-100 text-slate-600",
  cancelado: "bg-slate-100 text-slate-500",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function ReapreciacoesPage() {
  const [items, setItems] = useState<Pedido[]>([]);
  const [filter, setFilter] = useState<"todos" | Estado>("pendente");
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [decision, setDecision] = useState<"em_analise" | "deferido" | "indeferido">("em_analise");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/academico/raa/reapreciacao", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível carregar as reapreciações.");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar a fila.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = filter === "todos" ? items : items.filter((item) => item.estado === filter);

  const submitDecision = async () => {
    if (!selected || reason.trim().length < 5) {
      setMessage("Explique a decisão com pelo menos 5 caracteres.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/academico/raa/reapreciacao/decisao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, estado: decision, decisao_motivo: reason.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível guardar a decisão.");
      setSelected(null);
      setReason("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao guardar a decisão.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-5">
      <DashboardHeader
        title="Reapreciações RAA"
        description="Uma fila única para analisar pedidos, decidir e manter o protocolo rastreável."
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Secretaria", href: "/secretaria" }, { label: "Reapreciações" }]}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Fila da escola</h2>
            <p className="text-xs text-slate-500">O prazo e o estado vêm do mesmo pedido persistido usado pelo professor.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(event) => setFilter(event.target.value as "todos" | Estado)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="pendente">Pendentes</option>
              <option value="em_analise">Em análise</option>
              <option value="deferido">Deferidos</option>
              <option value="indeferido">Indeferidos</option>
              <option value="todos">Todos</option>
            </select>
            <button onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Atualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {message && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>}

        <div className="mt-4 space-y-3">
          {!loading && visible.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Nenhum pedido neste estado.</p>}
          {visible.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.protocolo_publico}</p>
                  <p className="mt-1 text-xs text-slate-500">Matrícula {item.matricula_id.slice(0, 8)} · Disciplina {item.disciplina_id.slice(0, 8)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[item.estado]}`}>{labels[item.estado]}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{item.motivo}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>Pedido em {formatDate(item.created_at)}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Prazo {formatDate(item.prazo_em)}</span>
                {item.nota_referencia !== null && <span>Nota de referência: {item.nota_referencia}</span>}
              </div>
              {(item.estado === "pendente" || item.estado === "em_analise") && (
                <button onClick={() => { setSelected(item); setDecision(item.estado === "pendente" ? "em_analise" : "deferido"); setReason(item.decisao_motivo || ""); }} className="mt-4 rounded-lg bg-klasse-green px-3 py-2 text-xs font-semibold text-white hover:bg-klasse-green/90">
                  Abrir decisão
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="raa-decision-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="raa-decision-title" className="font-semibold text-slate-900">Decidir {selected.protocolo_publico}</h2><p className="mt-1 text-xs text-slate-500">A decisão fica registada no pedido e será visível no fluxo do professor.</p></div>
              <button onClick={() => setSelected(null)} className="text-slate-400" aria-label="Fechar">×</button>
            </div>
            <label className="mt-5 block text-sm font-medium text-slate-700">Estado</label>
            <select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="em_analise">Em análise</option><option value="deferido">Deferir</option><option value="indeferido">Indeferir</option>
            </select>
            <label className="mt-4 block text-sm font-medium text-slate-700">Motivo da decisão</label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Registe a fundamentação para a secretaria e para o histórico." />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Cancelar</button>
              <button disabled={saving} onClick={() => void submitDecision()} className="inline-flex items-center gap-2 rounded-lg bg-klasse-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {decision === "deferido" ? <CheckCircle2 className="h-4 w-4" /> : decision === "indeferido" ? <XCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {saving ? "A guardar..." : "Guardar decisão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
