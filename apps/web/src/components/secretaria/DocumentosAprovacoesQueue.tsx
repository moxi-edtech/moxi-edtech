"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, FileText, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  OperationalTableEmptyState,
  OperationalTableErrorState,
  OperationalTableFilterBar,
  OperationalTablePagination,
} from "@/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "@/lib/operacoes/operational-table";
import { formatDateTime } from "@/lib/formatters";

type Approval = {
  id: string;
  aluno_id: string;
  servico_codigo: string;
  servico_nome: string;
  created_at: string;
  reason_detail?: string | null;
  aluno?: { nome?: string | null; nome_completo?: string | null; numero_processo?: string | null } | null;
};
type Decision = "approve" | "reject";
const PAGE_SIZE = 10;

export default function DocumentosAprovacoesQueue() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/secretaria/documentos/aprovacoes", {
        cache: "no-store", signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar a fila.");
      if (controller.signal.aborted) return;
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      if (controller.signal.aborted) return;
      setLoadError(err instanceof Error ? err.message : "Falha ao carregar a fila.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { requestRef.current?.abort(); };
  }, [load]);

  const pagination = useMemo(() => filterAndPaginateOperationalRows({
    rows: items,
    search,
    getSearchText: (item) => [
      item.aluno?.nome_completo ?? item.aluno?.nome ?? "",
      item.aluno?.numero_processo ?? "",
      item.servico_nome ?? "",
      item.servico_codigo ?? "",
    ].join(" "),
    page,
    pageSize: PAGE_SIZE,
  }), [items, search, page]);

  const openDecision = (item: Approval, next: Decision) => {
    if (loading || submitting) return;
    setSelected(item);
    setDecision(next);
    setReason("");
    setActionError(null);
    setFeedback(null);
  };

  const submitDecision = async () => {
    if (!selected || submitting || (decision === "reject" && !reason.trim())) return;
    setSubmitting(true);
    setActionError(null);
    const selectedId = selected.id;
    try {
      const response = await fetch("/api/secretaria/documentos/aprovacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: selectedId, decision, ...(decision === "reject" ? { motivo: reason.trim() } : {}) }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível concluir a decisão.");
      setItems((current) => current.filter((entry) => entry.id !== selectedId));
      setFeedback(json.message || "Decisão registada.");
      setSelected(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível concluir a decisão.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 text-foreground shadow-sm sm:p-5" aria-labelledby="documentos-aprovacoes-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock3 className="h-4 w-4" aria-hidden="true" /> Fila de decisão
          </div>
          <h2 id="documentos-aprovacoes-title" className="text-lg font-semibold">Documentos gratuitos aguardando aprovação</h2>
          <p className="text-sm text-muted-foreground">Aprovações de documentos gratuitos. Pagamentos são validados em Recebimentos.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || submitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" /> Atualizar
        </button>
      </div>

      {feedback && <p role="status" className="rounded-xl border border-border bg-muted px-3 py-2 text-sm">{feedback}</p>}
      <OperationalTableFilterBar
        label="Pesquisar pedidos de documentos"
        placeholder="Aluno, processo ou documento"
        query={search}
        onQueryChange={(value) => { setSearch(value); setPage(1); }}
      />

      {loading ? (
        <div role="status" aria-label="A carregar aprovações de documentos" aria-busy="true" className="space-y-3">
          <span className="sr-only">A carregar pedidos</span>
          {[0, 1, 2].map((index) => <div key={index} aria-hidden="true" className="space-y-3 rounded-xl border border-border p-4 motion-safe:animate-pulse">
            <div className="h-4 w-1/2 rounded-full bg-muted" />
            <div className="h-3 w-2/3 rounded-full bg-muted" />
            <div className="h-11 w-48 max-w-full rounded-xl bg-muted" />
          </div>)}
        </div>
      ) : loadError ? (
        <OperationalTableErrorState description={loadError} onRetry={() => void load()} />
      ) : pagination.filteredCount === 0 ? (
        <OperationalTableEmptyState
          title={search ? "Nenhum pedido corresponde à pesquisa." : "Nenhum documento gratuito aguarda decisão."}
          description={search ? "Limpe a pesquisa para ver os pedidos carregados." : "Novas solicitações aparecerão nesta fila."}
        />
      ) : (
        <>
          <div className="grid gap-3">
            {pagination.items.map((item) => {
              const nome = item.aluno?.nome_completo || item.aluno?.nome || "Aluno";
              return (
                <article key={item.id} className="rounded-xl border border-border p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <h3 className="break-words font-semibold">{item.servico_nome}</h3>
                    </div>
                    <p className="break-words text-sm text-foreground">{nome}{item.aluno?.numero_processo ? ` · Processo ${item.aluno.numero_processo}` : ""}</p>
                    <p className="text-xs text-muted-foreground">Solicitado em {formatDateTime(item.created_at)}</p>
                    {item.reason_detail && <p className="break-words text-xs text-muted-foreground">{item.reason_detail}</p>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:shrink-0">
                    <button type="button" disabled={loading || submitting} onClick={() => openDecision(item, "reject")}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                      <X className="h-4 w-4" aria-hidden="true" /> Rejeitar
                    </button>
                    <button type="button" disabled={loading || submitting} onClick={() => openDecision(item, "approve")}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-klasse-gold px-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
                      <Check className="h-4 w-4" aria-hidden="true" /> Aprovar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <OperationalTablePagination
            page={pagination.currentPage}
            pageSize={PAGE_SIZE}
            total={pagination.filteredCount}
            onPageChange={setPage}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">Paginação dos pedidos carregados (até 50 por consulta), não do total histórico.</p>
        </>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !submitting) setSelected(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-xl bg-background p-5 text-foreground">
          <DialogTitle>{decision === "approve" ? "Aprovar documento" : "Rejeitar documento"}</DialogTitle>
          <DialogDescription>
            {decision === "approve"
              ? "O aluno poderá emitir o documento após a aprovação."
              : "A rejeição será registada e o aluno poderá consultar o motivo."}
          </DialogDescription>
          <p className="break-words text-sm font-semibold">
            {selected?.servico_nome} · {selected?.aluno?.nome_completo || selected?.aluno?.nome || "Aluno"}
          </p>
          {decision === "reject" && (
            <label className="block space-y-2 text-sm font-medium" htmlFor="documento-reject-reason">
              <span>Motivo da rejeição (obrigatório)</span>
              <textarea id="documento-reject-reason" rows={3} maxLength={500} disabled={submitting}
                value={reason} onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" />
            </label>
          )}
          {actionError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{actionError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={() => setSelected(null)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
            <button type="button" disabled={submitting || (decision === "reject" && !reason.trim())}
              onClick={() => void submitDecision()}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${decision === "reject" ? "bg-destructive hover:opacity-90" : "bg-klasse-gold hover:brightness-95"}`}>
              {submitting ? "A guardar…" : decision === "approve" ? "Confirmar aprovação" : "Confirmar rejeição"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
