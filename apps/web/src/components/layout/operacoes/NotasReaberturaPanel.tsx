"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import SecaoLabel from "@/components/shared/SecaoLabel";

type Item = { id: string; turma_id: string; disciplina_id: string; turma_nome?: string; disciplina_nome?: string; professor_nome?: string; trimestre: number; motivo: string; created_at: string };

export default function NotasReaberturaPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/secretaria/notas/reabertura", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar as solicitações.");
      setItems(payload.items ?? []);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar as solicitações."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);

  const decide = async (id: string, status: "APROVADO" | "REJEITADO") => {
    if (actingId) return;
    if (status === "REJEITADO" && reason.trim().length < 5) { setMessage("Informe o motivo da rejeição."); return; }
    setActingId(id);
    let response: Response;
    try { response = await fetch("/api/secretaria/notas/reabertura", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, motivo_decisao: status === "REJEITADO" ? reason.trim() : null }) }); } catch { setMessage("Não foi possível contactar o servidor. Tente novamente."); setActingId(null); return; }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) { setMessage(payload?.error ?? "Não foi possível atualizar a solicitação."); setActingId(null); return; }
    setMessage(status === "APROVADO" ? "Reabertura aprovada por 24 horas." : "Solicitação rejeitada.");
    setRejecting(null); setReason(""); await load(); setActingId(null);
  };

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-5 w-56 animate-pulse rounded bg-slate-100" /><div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" /></section>;
  if (loadError) return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-black">Não foi possível carregar as reaberturas.</p><p className="mt-1">{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></section>;
  if (!items.length) return null;
  return <section id="operacoes-reabertura-notas" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4"><SecaoLabel className="text-klasse-green">Acompanhamento académico</SecaoLabel><div className="mt-1 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-klasse-green" /><div><h2 className="font-black text-slate-900">Reabertura de notas</h2><p className="text-xs text-slate-500">Solicitações de professores aguardando decisão.</p></div></div></div>
    <div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3"><div className="flex flex-wrap items-start gap-3"><div className="min-w-[220px] flex-1"><p className="font-bold text-slate-900">{item.turma_nome} · {item.disciplina_nome}</p><p className="text-xs text-slate-500">{item.professor_nome} · Trimestre {item.trimestre}</p><p className="mt-2 text-sm text-slate-700">{item.motivo}</p></div><div className="flex items-center gap-2">{rejecting === item.id ? <><input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-xs" /><button type="button" disabled={Boolean(actingId)} onClick={() => void decide(item.id, "REJEITADO")} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{actingId === item.id ? "A guardar..." : "Confirmar"}</button><button type="button" disabled={Boolean(actingId)} onClick={() => { setRejecting(null); setReason(""); }} className="text-xs font-bold text-slate-500 disabled:opacity-60">Cancelar</button></> : <><button type="button" disabled={Boolean(actingId)} onClick={() => { setRejecting(item.id); setReason(""); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-60"><XCircle className="h-3.5 w-3.5" /> Rejeitar</button><button type="button" disabled={Boolean(actingId)} onClick={() => void decide(item.id, "APROVADO")} className="inline-flex items-center gap-1 rounded-lg bg-klasse-green px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> {actingId === item.id ? "A guardar..." : "Aprovar"}</button></>}</div></div></div>)}</div>
    {message && <p className="mt-3 text-xs font-bold text-slate-600">{message}</p>}
  </section>;
}
