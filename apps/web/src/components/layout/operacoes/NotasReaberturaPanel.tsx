"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, ShieldX } from "lucide-react";

type Status = "PENDENTE" | "APROVADO";
type Decision = "APROVADO" | "REJEITADO" | "EXPIRADO";
type Item = {
  id: string;
  turma_nome?: string;
  disciplina_nome?: string;
  professor_nome?: string;
  trimestre: number;
  motivo: string;
  status: string;
  expira_em: string | null;
  created_at: string;
};
type Response = { ok: boolean; items?: Item[]; total?: number; partial?: boolean; error?: string };

export default function NotasReaberturaPanel({ onDecided }: { onDecided?: () => void } = {}) {
  const [tab, setTab] = useState<Status>("PENDENTE");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [partial, setPartial] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"REJEITADO" | "EXPIRADO">("REJEITADO");
  const [reason, setReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/secretaria/notas/reabertura?status=${tab}`, { cache: "no-store" });
      const data = await res.json().catch(() => null) as Response | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Não foi possível carregar os pedidos.");
      setItems(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
      setPartial(Boolean(data.partial));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Não foi possível consultar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const decide = async (id: string, status: Decision) => {
    if (actingId) return;
    if (status !== "APROVADO" && reason.trim().length < 5) {
      setMessage("Indica o motivo da decisão (mínimo de 5 caracteres).");
      return;
    }
    setActingId(id);
    setMessage(null);
    try {
      const res = await fetch("/api/secretaria/notas/reabertura", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, status,
          motivo_decisao: status === "APROVADO" ? null : reason.trim(),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível decidir o pedido.");
      setMessage(status === "APROVADO" ? "Reabertura aprovada por 24 horas." :
        status === "EXPIRADO" ? "Autorização revogada." : "Pedido rejeitado.");
      setEditingId(null);
      setReason("");
      await load();
      window.dispatchEvent(new Event("klasse:reabertura-atualizada"));
      onDecided?.();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível decidir o pedido.");
    } finally {
      setActingId(null);
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" })
      .format(new Date(value));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado dos pedidos">
        {(["PENDENTE", "APROVADO"] as const).map((status) => (
          <button
            type="button" role="tab" aria-selected={tab === status}
            key={status}
            onClick={() => { setTab(status); setEditingId(null); setReason(""); }}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${tab === status ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground"}`}
          >
            {status === "PENDENTE" ? "Por decidir" : "Autorizadas"}
          </button>
        ))}
      </div>

      {loading ? <div className="h-14 animate-pulse rounded-xl bg-muted" /> :
        loadError ? <div role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm">
          <p>{loadError}</p>
          <button type="button" className="mt-2 font-semibold text-klasse-green" onClick={() => void load()}>Tentar novamente</button>
        </div> :
          items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido neste estado.</p> :
            <div className="space-y-2">
              {items.map((item) => {
                const expired = item.status === "APROVADO" && item.expira_em &&
                  Date.parse(item.expira_em) <= Date.now();
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">{item.turma_nome} · {item.disciplina_nome}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.professor_nome} · {item.trimestre}.º trimestre</p>
                    <p className="mt-2 text-sm text-foreground">{item.motivo}</p>
                    {item.expira_em && tab === "APROVADO" && (
                      <p className="mt-1 text-xs text-muted-foreground">{expired ? "Prazo expirado" : `Válido até ${formatDate(item.expira_em)}`}</p>
                    )}

                    {editingId === item.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          aria-label="Motivo da decisão" autoFocus value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Motivo da decisão" className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                        />
                        <button type="button" disabled={Boolean(actingId)} onClick={() => void decide(item.id, decision)}
                          className="rounded-xl bg-klasse-gold px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60">
                          Confirmar
                        </button>
                        <button type="button" onClick={() => { setEditingId(null); setReason(""); }}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Cancelar</button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tab === "PENDENTE" ? <>
                          <button type="button" disabled={Boolean(actingId)} onClick={() => void decide(item.id, "APROVADO")}
                            className="inline-flex items-center gap-1 rounded-xl bg-klasse-gold px-3 py-2 text-xs font-semibold text-background disabled:opacity-60">
                            <Check className="h-4 w-4" aria-hidden="true" /> Aprovar
                          </button>
                          <button type="button" disabled={Boolean(actingId)} onClick={() => { setEditingId(item.id); setDecision("REJEITADO"); }}
                            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground">
                            <X className="h-4 w-4" aria-hidden="true" /> Rejeitar
                          </button>
                        </> : !expired && (
                          <button type="button" disabled={Boolean(actingId)} onClick={() => { setEditingId(item.id); setDecision("EXPIRADO"); }}
                            className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive">
                            <ShieldX className="h-4 w-4" aria-hidden="true" /> Revogar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}
      {partial && <p className="text-xs text-muted-foreground">A apresentar os primeiros {items.length} de {total} pedidos.</p>}
      {message && <p role="status" className="text-sm font-medium text-foreground">{message}</p>}
    </section>
  );
}
