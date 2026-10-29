"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Item = {
  id: string; aluno_id: string; data_falta: string; motivo: string; created_at: string;
  aluno?: { nome?: string | null; nome_completo?: string | null; numero_processo?: string | null } | null;
};

const dateLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("pt-AO", { dateStyle: "medium" });

export function FaltasJustificacoesQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/secretaria/faltas/justificacoes", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível consultar os pedidos.");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar as justificações.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openDecision = (item: Item, next: "approved" | "rejected") => {
    setSelected(item); setDecision(next); setReason(""); setFeedback(null);
  };

  const submitDecision = async () => {
    if (!selected || submitting || (decision === "rejected" && reason.trim().length < 8)) return;
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/secretaria/faltas/justificacoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, decision, motivo: reason.trim() || undefined }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível concluir a decisão.");
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setFeedback(json.message || "Decisão registada.");
      setSelected(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "A decisão não foi confirmada. Tenta novamente.");
    } finally { setSubmitting(false); }
  };

  return (
    <section className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4 text-foreground" aria-labelledby="faltas-queue-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="faltas-queue-title" className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" /> Justificações de faltas
          </h2>
          <p className="text-sm text-muted-foreground">Pedidos enviados por encarregados ou alunos maiores de idade, para decisão da escola.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </button>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">A carregar justificações…</p>}
      {feedback && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{feedback}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Não há justificações aguardando análise.</p>}
      {items.map((item) => (
        <article key={item.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold">{item.aluno?.nome_completo || item.aluno?.nome || "Aluno"}</p>
              <p className="text-xs text-muted-foreground">Falta em {dateLabel(item.data_falta)}
                {item.aluno?.numero_processo ? ` · Processo ${item.aluno.numero_processo}` : ""}
              </p>
            </div>
            <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs">Aguardando análise</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">{item.motivo}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openDecision(item, "approved")}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Aprovar justificação
            </button>
            <button type="button" onClick={() => openDecision(item, "rejected")}
              className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">
              Não aceitar
            </button>
          </div>
        </article>
      ))}
      <Dialog open={Boolean(selected)} onOpenChange={(value) => { if (!value && !submitting) setSelected(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto bg-background p-5 text-foreground">
          <DialogTitle>{decision === "approved" ? "Aprovar justificação" : "Não aceitar justificação"}</DialogTitle>
          <DialogDescription>
            {decision === "approved"
              ? "A decisão será registada e visível para o aluno. A ausência original continuará no histórico."
              : "Indica o motivo da recusa. O aluno poderá corrigir e enviar um novo pedido."}
          </DialogDescription>
          <p className="text-sm font-semibold">{selected?.aluno?.nome_completo || selected?.aluno?.nome || "Aluno"}</p>
          <label htmlFor="falta-decision-reason" className="text-sm font-medium">
            {decision === "rejected" ? "Motivo da decisão (obrigatório)" : "Observação (opcional)"}
          </label>
          <textarea id="falta-decision-reason" rows={3} maxLength={1000} value={reason} disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={() => setSelected(null)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Cancelar</button>
            <button type="button" disabled={submitting || (decision === "rejected" && reason.trim().length < 8)}
              onClick={() => void submitDecision()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {submitting ? "A guardar…" : "Confirmar decisão"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
