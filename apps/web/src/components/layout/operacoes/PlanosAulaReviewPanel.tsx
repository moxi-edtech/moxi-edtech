"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, RotateCcw } from "lucide-react";

type ReviewPlan = { id: string; data: string; status: string; tema: string; objetivos: string | null; returned_reason: string | null };

export default function PlanosAulaReviewPanel() {
  const [items, setItems] = useState<ReviewPlan[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/secretaria/planos-aula", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar os planos.");
      setItems(payload.items ?? []);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar os planos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  const review = async (id: string, status: "aprovado" | "devolvido") => {
    if (actingId) return;
    const reviewReason = status === "devolvido" ? reason.trim() : null;
    if (status === "devolvido" && !reviewReason) { setMessage("Informe o motivo da devolução."); return; }
    setActingId(id);
    try {
    const response = await fetch(`/api/secretaria/planos-aula?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, returned_reason: reviewReason }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) { setMessage(payload?.error ?? "Não foi possível atualizar o plano."); return; }
    setMessage(status === "aprovado" ? "Plano aprovado." : "Plano devolvido para ajustes."); setReturningId(null); setReason(""); await load();
    } finally { setActingId(null); }
  };
  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-5 w-56 animate-pulse rounded bg-slate-100" /><div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" /></section>;
  if (loadError) return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-black">Não foi possível carregar a revisão de planos.</p><p className="mt-1">{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></section>;
  if (!items.length) return null;
  return <section id="operacoes-planos-revisao" className="scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/40 p-5"><div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-amber-700" /><div><h2 className="font-black text-slate-900">Revisão de planos de aula</h2><p className="text-xs text-slate-500">Planos enviados ou devolvidos que precisam de atenção.</p></div></div><div className="space-y-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3"><div className="min-w-[180px] flex-1"><p className="font-bold text-slate-900">{item.tema}</p><p className="text-xs text-slate-500">{item.data} · {item.status}</p>{item.returned_reason && <p className="mt-1 text-xs text-rose-600">{item.returned_reason}</p>}</div>{returningId === item.id ? <div className="flex min-w-[240px] flex-1 items-center gap-2"><input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da devolução" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" /><button type="button" disabled={Boolean(actingId)} onClick={() => void review(item.id, "devolvido")} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{actingId === item.id ? "A guardar..." : "Confirmar"}</button><button type="button" disabled={Boolean(actingId)} onClick={() => { setReturningId(null); setReason(""); }} className="text-xs font-bold text-slate-500 disabled:opacity-60">Cancelar</button></div> : <><button type="button" disabled={Boolean(actingId)} onClick={() => { setReturningId(item.id); setReason(""); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" /> Devolver</button><button type="button" disabled={Boolean(actingId)} onClick={() => void review(item.id, "aprovado")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {actingId === item.id ? "A guardar..." : "Aprovar"}</button></>}</div>)}</div>{message && <p className="mt-3 text-xs font-bold text-slate-600">{message}</p>}</section>;
}
