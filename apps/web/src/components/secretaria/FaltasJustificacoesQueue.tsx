"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  OperationalTableEmptyState,
  OperationalTableErrorState,
  OperationalTableFilterBar,
  OperationalTablePagination,
} from "@/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "@/lib/operacoes/operational-table";
import { formatDate } from "@/lib/formatters";

type Item = {
  id: string; aluno_id: string; data_falta: string; motivo: string; created_at: string;
  aluno?: { nome?: string | null; nome_completo?: string | null; numero_processo?: string | null } | null;
};
const PAGE_SIZE = 10;

export function FaltasJustificacoesQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
      const response = await fetch("/api/secretaria/faltas/justificacoes", {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível consultar os pedidos.");
      if (controller.signal.aborted) return;
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as justificações.");
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
      item.motivo ?? "",
      item.data_falta ?? "",
    ].join(" "),
    page,
    pageSize: PAGE_SIZE,
  }), [items, search, page]);

  const openDecision = (item: Item, next: "approved" | "rejected") => {
    if (loading || submitting) return;
    setSelected(item);
    setDecision(next);
    setReason("");
    setFeedback(null);
    setActionError(null);
  };

  const submitDecision = async () => {
    if (!selected || submitting || (decision === "rejected" && reason.trim().length < 8)) return;
    setSubmitting(true);
    setActionError(null);
    const selectedId = selected.id;
    try {
      const response = await fetch("/api/secretaria/faltas/justificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, decision, motivo: reason.trim() || undefined }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível concluir a decisão.");
      setItems((current) => current.filter((item) => item.id !== selectedId));
      setFeedback(json.message || "Decisão registada.");
      setSelected(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "A decisão não foi confirmada. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4 text-foreground shadow-sm sm:p-5" aria-labelledby="faltas-queue-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="faltas-queue-title" className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Justificações de faltas
          </h2>
          <p className="text-sm text-muted-foreground">Pedidos de alunos e encarregados para decisão da escola.</p>
        </div>
        <button type="button" disabled={loading || submitting} onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" /> Atualizar
        </button>
      </div>

      {feedback && <p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">{feedback}</p>}
      {actionError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{actionError}</p>}

      <OperationalTableFilterBar
        label="Pesquisar justificações"
        placeholder="Aluno, processo, motivo ou data"
        query={search}
        onQueryChange={(value) => { setSearch(value); setPage(1); }}
      />

      {loading ? (
        <div role="status" aria-label="A carregar justificações" aria-busy="true" className="space-y-3">
          <span className="sr-only">A carregar justificações</span>
          {[0, 1, 2].map((index) => <div key={index} aria-hidden="true" className="space-y-3 rounded-xl border border-border p-4 motion-safe:animate-pulse">
            <div className="h-4 w-1/3 rounded-full bg-muted" />
            <div className="h-3 w-2/3 rounded-full bg-muted" />
            <div className="h-11 w-48 max-w-full rounded-xl bg-muted" />
          </div>)}
        </div>
      ) : loadError ? (
        <OperationalTableErrorState description={loadError} onRetry={() => void load()} />
      ) : pagination.filteredCount === 0 ? (
        <OperationalTableEmptyState
          title={search ? "Nenhuma justificação encontrada." : "Não há justificações aguardando análise."}
          description={search ? "Limpe a pesquisa para ver os pedidos carregados." : "Novos pedidos aparecerão nesta fila."}
        />
      ) : (
        <>
          <div className="grid gap-3">
            {pagination.items.map((item) => (
              <article key={item.id} className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words font-semibold">{item.aluno?.nome_completo || item.aluno?.nome || "Aluno"}</p>
                    <p className="text-xs text-muted-foreground">Falta em {formatDate(item.data_falta)}
                      {item.aluno?.numero_processo ? ` · Processo ${item.aluno.numero_processo}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">Aguardando análise</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{item.motivo}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={loading || submitting} onClick={() => openDecision(item, "approved")}
                    className="min-h-11 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-klasse-gold-900 hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50">
                    Aprovar justificação
                  </button>
                  <button type="button" disabled={loading || submitting} onClick={() => openDecision(item, "rejected")}
                    className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50">
                    Não aceitar
                  </button>
                </div>
              </article>
            ))}
          </div>
          <OperationalTablePagination
            page={pagination.currentPage}
            pageSize={PAGE_SIZE}
            total={pagination.filteredCount}
            disabled={submitting}
            onPageChange={setPage}
          />
          <p className="text-xs text-muted-foreground">Paginação dos pedidos carregados (até 100 por consulta), não do total histórico.</p>
        </>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(value) => { if (!value && !submitting) setSelected(null); }}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-xl bg-background p-5 text-foreground">
          <DialogTitle>{decision === "approved" ? "Aprovar justificação" : "Não aceitar justificação"}</DialogTitle>
          <DialogDescription>
            {decision === "approved"
              ? "A decisão será registada e visível para o aluno. A ausência original continuará no histórico."
              : "Indique o motivo da recusa. O aluno poderá corrigir e enviar um novo pedido."}
          </DialogDescription>
          <p className="text-sm font-semibold">{selected?.aluno?.nome_completo || selected?.aluno?.nome || "Aluno"}</p>
          <label htmlFor="falta-decision-reason" className="text-sm font-medium">
            {decision === "rejected" ? "Motivo da decisão (obrigatório)" : "Observação (opcional)"}
          </label>
          <textarea id="falta-decision-reason" rows={3} maxLength={1000} value={reason} disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-xl border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={() => setSelected(null)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
            <button type="button" disabled={submitting || (decision === "rejected" && reason.trim().length < 8)}
              onClick={() => void submitDecision()}
              className="min-h-11 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-klasse-gold-900 hover:brightness-95 disabled:opacity-50">
              {submitting ? "A guardar…" : "Confirmar decisão"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
