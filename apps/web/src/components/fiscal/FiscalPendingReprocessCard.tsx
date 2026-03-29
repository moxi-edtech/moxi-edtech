"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type FiscalPendingReprocessCardProps = {
  empresaId: string | null;
};

type ReprocessJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  total_links: number;
  processed_links: number;
  success_links: number;
  failed_links: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type ReprocessStatusResponse = {
  ok?: boolean;
  data?: {
    pending_links?: number;
    jobs?: ReprocessJob[];
  };
  error?: {
    message?: string;
  };
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-AO");
}

function normalizeJobStatus(status: ReprocessJob["status"]) {
  switch (status) {
    case "queued":
      return "QUEUED";
    case "processing":
      return "PROCESSING";
    case "completed":
      return "OK";
    case "failed":
      return "FAILED";
    default:
      return String(status).toUpperCase();
  }
}

export function FiscalPendingReprocessCard({ empresaId }: FiscalPendingReprocessCardProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState(0);
  const [jobs, setJobs] = useState<ReprocessJob[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeJob = useMemo(
    () => jobs.find((job) => job.status === "queued" || job.status === "processing") ?? null,
    [jobs]
  );
  const lastJob = useMemo(() => jobs[0] ?? null, [jobs]);

  const loadStatus = useCallback(async () => {
    if (!empresaId) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ empresa_id: empresaId });
      const response = await fetch(`/api/fiscal/financeiro/reprocess?${params.toString()}`, {
        cache: "no-store",
      });

      const json = (await response.json().catch(() => ({}))) as ReprocessStatusResponse;
      if (!response.ok || json.ok !== true) {
        setError(json.error?.message ?? "Falha ao carregar estado de pendências fiscais.");
        return;
      }

      setPendingLinks(Number(json.data?.pending_links ?? 0));
      setJobs(Array.isArray(json.data?.jobs) ? json.data.jobs : []);
    } catch {
      setError("Falha ao carregar estado de pendências fiscais.");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!activeJob) return;
    const interval = window.setInterval(() => {
      void loadStatus();
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeJob, loadStatus]);

  const triggerReprocess = async () => {
    if (!empresaId) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/fiscal/financeiro/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ empresa_id: empresaId }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };

      if (!response.ok || json.ok !== true) {
        throw new Error(json.error?.message || "Falha ao iniciar reprocessamento fiscal.");
      }

      setInfo("Reprocessamento enfileirado. O progresso será atualizado automaticamente.");
      setConfirmOpen(false);
      await loadStatus();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao iniciar reprocessamento fiscal.";
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  const canTrigger = Boolean(empresaId) && pendingLinks > 0 && !activeJob && !submitting;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pendências Financeiro para Fiscal</h2>
          <p className="text-xs text-slate-500">
            Reprocessa pagamentos pendentes/falhados sem intervenção técnica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
          <button
            type="button"
            disabled={!canTrigger}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg bg-[#1F6B3B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "A iniciar..." : "Reprocessar Pendências Fiscais"}
          </button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pendências ativas</p>
          <p className="text-sm font-semibold text-slate-900">{pendingLinks}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Job atual</p>
          <p className="text-sm font-semibold text-slate-900">
            {activeJob ? normalizeJobStatus(activeJob.status) : "Sem execução"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Última execução</p>
          <p className="text-sm font-semibold text-slate-900">{formatDateTime(lastJob?.created_at ?? null)}</p>
        </div>
      </div>

      {activeJob ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {normalizeJobStatus(activeJob.status)} - {activeJob.processed_links}/{activeJob.total_links} processados
          {" | "}
          OK: {activeJob.success_links} / Falhas: {activeJob.failed_links}
        </div>
      ) : null}

      {!activeJob && lastJob ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Último job: {normalizeJobStatus(lastJob.status)} | Processados: {lastJob.processed_links}/
          {lastJob.total_links} | Concluído: {formatDateTime(lastJob.completed_at)}
        </div>
      ) : null}

      {lastJob?.status === "failed" && lastJob.error_message ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {lastJob.error_message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}

      {info ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{info}</div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900">Confirmar Reprocessamento Fiscal</h3>
            <p className="mt-2 text-xs text-slate-600">
              Será iniciado um job assíncrono para reprocessar {pendingLinks} pendências
              financeiro-fiscal da escola.
            </p>
            <p className="mt-1 text-xs font-medium text-red-700">
              Esta ação deve ser usada após correções de dados/parametrização.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void triggerReprocess()}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "A iniciar..." : "Confirmar Reprocessamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
