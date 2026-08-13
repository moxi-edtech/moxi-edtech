"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";

type Item = { id: string; turma_id: string; disciplina_id: string; turma_nome?: string; disciplina_nome?: string; professor_nome?: string; trimestre: number; motivo: string; created_at: string };

export default function NotasReaberturaPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/secretaria/notas/reabertura", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.ok) setItems(payload.items ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, status: "APROVADO" | "REJEITADO") => {
    if (status === "REJEITADO" && reason.trim().length < 5) { setMessage("Informe o motivo da rejeição."); return; }
    const response = await fetch("/api/secretaria/notas/reabertura", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, motivo_decisao: status === "REJEITADO" ? reason.trim() : null }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) { setMessage(payload?.error ?? "Não foi possível atualizar a solicitação."); return; }
    setMessage(status === "APROVADO" ? "Reabertura aprovada por 24 horas." : "Solicitação rejeitada.");
    setRejecting(null); setReason(""); await load();
  };

  if (!items.length) return null;
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
    <div className="mb-4 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-indigo-700" /><div><h2 className="font-black text-slate-900">Reabertura de notas</h2><p className="text-xs text-slate-500">Solicitações de professores aguardando decisão.</p></div></div>
    <div className="space-y-2">{items.map((item) => <div key={item.id} className="rounded-xl border border-indigo-100 bg-white p-3"><div className="flex flex-wrap items-start gap-3"><div className="min-w-[220px] flex-1"><p className="font-bold text-slate-900">{item.turma_nome} · {item.disciplina_nome}</p><p className="text-xs text-slate-500">{item.professor_nome} · Trimestre {item.trimestre}</p><p className="mt-2 text-sm text-slate-700">{item.motivo}</p></div><div className="flex items-center gap-2">{rejecting === item.id ? <><input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-xs" /><button type="button" onClick={() => void decide(item.id, "REJEITADO")} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Confirmar</button><button type="button" onClick={() => { setRejecting(null); setReason(""); }} className="text-xs font-bold text-slate-500">Cancelar</button></> : <><button type="button" onClick={() => { setRejecting(item.id); setReason(""); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><XCircle className="h-3.5 w-3.5" /> Rejeitar</button><button type="button" onClick={() => void decide(item.id, "APROVADO")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar</button></>}</div></div></div>)}</div>
    {message && <p className="mt-3 text-xs font-bold text-slate-600">{message}</p>}
  </section>;
}
