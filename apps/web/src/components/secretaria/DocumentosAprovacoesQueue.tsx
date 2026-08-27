"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, FileText, RefreshCw, X } from "lucide-react";

type Approval = {
  id: string;
  aluno_id: string;
  servico_codigo: string;
  servico_nome: string;
  created_at: string;
  reason_detail?: string | null;
  aluno?: { nome?: string | null; nome_completo?: string | null; numero_processo?: string | null } | null;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function DocumentosAprovacoesQueue() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/secretaria/documentos/aprovacoes", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Falha ao carregar a fila");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a fila");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: Approval, decision: "approve" | "reject") => {
    const nome = item.aluno?.nome_completo || item.aluno?.nome || "Aluno";
    const motivo = decision === "reject" ? window.prompt(`Motivo da rejeição para ${nome}:`, "Documentação insuficiente")?.trim() : undefined;
    if (decision === "reject" && !motivo) return;
    if (decision === "approve" && !window.confirm(`Aprovar ${item.servico_nome} para ${nome}? O aluno poderá emitir o documento.`)) return;
    setBusyId(item.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/secretaria/documentos/aprovacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoId: item.id, decision, motivo }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Não foi possível concluir a decisão");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setFeedback(json.message || "Decisão registada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a decisão");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-klasse-blue-100 bg-white p-4 shadow-sm md:p-5" aria-labelledby="documentos-aprovacoes-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-klasse-blue-700"><Clock3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Fila de decisão</span></div>
          <h2 id="documentos-aprovacoes-title" className="text-lg font-semibold text-slate-900">Documentos gratuitos aguardando aprovação</h2>
          <p className="mt-1 text-sm text-slate-600">Esta fila é da Secretaria Digital. Pagamentos continuam a ser tratados em Recebimentos.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
      </div>
      {feedback && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback}</p>}
      {error && <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Tentar novamente</button></div>}
      {loading && <p className="mt-5 text-sm text-slate-500">A carregar pedidos…</p>}
      {!loading && !error && items.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500"><Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" />Nenhum documento gratuito aguarda decisão.</div>}
      {!loading && items.length > 0 && <div className="mt-4 grid gap-3">{items.map((item) => {
        const nome = item.aluno?.nome_completo || item.aluno?.nome || "Aluno";
        return <article key={item.id} className="rounded-xl border border-slate-200 p-3 md:flex md:items-center md:justify-between md:gap-4">
          <div className="min-w-0"><div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-klasse-blue-600" /><h3 className="truncate font-medium text-slate-900">{item.servico_nome}</h3></div><p className="mt-1 text-sm text-slate-700">{nome}{item.aluno?.numero_processo ? ` · Processo ${item.aluno.numero_processo}` : ""}</p><p className="text-xs text-slate-500">Solicitado em {formatDate(item.created_at)} · próximo passo: revisar e decidir</p>{item.reason_detail && <p className="mt-1 text-xs text-amber-700">{item.reason_detail}</p>}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:w-auto md:shrink-0"><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "reject")} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"><X className="h-4 w-4" /> Rejeitar</button><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "approve")} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-klasse-blue-600 px-3 text-sm font-medium text-white hover:bg-klasse-blue-700 disabled:opacity-60"><Check className="h-4 w-4" /> Aprovar</button></div>
        </article>;
      })}</div>}
    </section>
  );
}
