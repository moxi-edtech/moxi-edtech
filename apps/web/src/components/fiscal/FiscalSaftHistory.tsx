"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

type FiscalSaftHistoryProps = {
  empresaId: string | null;
  refreshKey?: number;
};

type SaftExportItem = {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  arquivo_storage_path: string | null;
  checksum_sha256: string;
  xsd_version: string;
  status: "queued" | "processing" | "generated" | "validated" | "failed" | "submitted" | string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type SaftHistoryApiResponse = {
  ok?: boolean;
  data?: {
    exports?: SaftExportItem[];
  };
  error?: {
    message?: string;
  };
};

type FilterStatus = "" | "COMPLETED" | "FAILED" | "PROCESSING";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-AO");
}

function formatPeriod(start: string, end: string) {
  return `${start} -> ${end}`;
}

function shortHash(value: string) {
  if (!value) return "—";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function getStatusLabel(status: SaftExportItem["status"]) {
  switch (status) {
    case "queued":
      return "QUEUED";
    case "processing":
      return "PROCESSING";
    case "generated":
      return "GENERATED";
    case "validated":
      return "VALIDATED";
    case "submitted":
      return "SUBMITTED";
    case "failed":
      return "FAILED";
    default:
      return status.toUpperCase();
  }
}

export function FiscalSaftHistory({ empresaId, refreshKey = 0 }: FiscalSaftHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safePathname = pathname ?? "/financeiro/fiscal";
  const currentSearchParams = searchParams ?? new URLSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SaftExportItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<SaftExportItem | null>(null);

  const canLoad = useMemo(() => Boolean(empresaId), [empresaId]);

  const selectedYear = useMemo(() => {
    const raw = (currentSearchParams.get("year") ?? "").trim();
    return /^\d{4}$/.test(raw) ? raw : "";
  }, [currentSearchParams]);

  const selectedStatus = useMemo<FilterStatus>(() => {
    const raw = (currentSearchParams.get("status") ?? "").trim().toUpperCase();
    if (raw === "COMPLETED" || raw === "FAILED" || raw === "PROCESSING") return raw;
    return "";
  }, [currentSearchParams]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromItems = items
      .map((item) => Number(item.periodo_inicio.slice(0, 4)))
      .filter((year) => Number.isFinite(year));
    const uniqueYears = Array.from(new Set([currentYear, currentYear - 1, ...yearsFromItems]));
    uniqueYears.sort((a, b) => b - a);
    return uniqueYears.map((year) => String(year));
  }, [items]);

  const updateFilters = (next: { year?: string; status?: FilterStatus }) => {
    const params = new URLSearchParams(currentSearchParams.toString());

    if (Object.prototype.hasOwnProperty.call(next, "year")) {
      const year = (next.year ?? "").trim();
      if (/^\d{4}$/.test(year)) {
        params.set("year", year);
      } else {
        params.delete("year");
      }
    }

    if (Object.prototype.hasOwnProperty.call(next, "status")) {
      const status = (next.status ?? "").trim().toUpperCase();
      if (status === "COMPLETED" || status === "FAILED" || status === "PROCESSING") {
        params.set("status", status);
      } else {
        params.delete("status");
      }
    }

    const nextUrl = params.toString() ? `${safePathname}?${params.toString()}` : safePathname;
    router.replace(nextUrl, { scroll: false });
  };

  const loadHistory = useCallback(async () => {
    if (!empresaId) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        empresa_id: empresaId,
        limit: "20",
      });
      if (selectedYear) params.set("year", selectedYear);
      if (selectedStatus) params.set("status", selectedStatus);

      const response = await fetch(`/api/fiscal/saft/export?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as SaftHistoryApiResponse;

      if (!response.ok || json.ok !== true) {
        setError(json.error?.message ?? "Não foi possível carregar o histórico de SAF-T.");
        return;
      }

      setItems(Array.isArray(json.data?.exports) ? json.data.exports : []);
    } catch {
      setError("Não foi possível carregar o histórico de SAF-T.");
    } finally {
      setLoading(false);
    }
  }, [empresaId, selectedYear, selectedStatus]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  useEffect(() => {
    if (items.every((item) => item.status !== "queued" && item.status !== "processing")) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadHistory();
    }, 8000);

    return () => {
      window.clearInterval(interval);
    };
  }, [items, loadHistory]);

  const getFailureHint = (item: SaftExportItem) => {
    const meta = item.metadata;
    if (!meta || typeof meta !== "object") return null;

    const xsdValidation = (meta as Record<string, unknown>).xsd_validation;
    if (xsdValidation && typeof xsdValidation === "object") {
      const failures = (xsdValidation as Record<string, unknown>).failures;
      if (Array.isArray(failures) && failures.length > 0) {
        const first = failures[0] as Record<string, unknown>;
        const node = typeof first.node === "string" ? first.node : "nó desconhecido";
        const line = typeof first.line === "number" ? String(first.line) : "s/linha";
        const message = typeof first.message === "string" ? first.message : "falha de validação XSD";
        return `XSD ${line} ${node}: ${message}`;
      }
    }

    const worker = (meta as Record<string, unknown>).worker;
    if (worker && typeof worker === "object") {
      const workerError = (worker as Record<string, unknown>).error;
      if (typeof workerError === "string" && workerError.trim().length > 0) {
        return workerError;
      }
    }

    return null;
  };

  const openDownload = async (item: SaftExportItem) => {
    if (!item?.id) return;
    setDownloadingId(item.id);
    try {
      const response = await fetch(`/api/fiscal/saft/export/${encodeURIComponent(item.id)}/download`, {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { download_url?: string };
        error?: { message?: string };
      };
      if (!response.ok || json.ok !== true || !json.data?.download_url) {
        throw new Error(json.error?.message || "Não foi possível gerar link de download.");
      }
      window.open(json.data.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao iniciar download.";
      setError(text);
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmRetry = async () => {
    if (!retryTarget?.id) return;

    setRetryingId(retryTarget.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/fiscal/saft/export/${encodeURIComponent(retryTarget.id)}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };

      if (!response.ok || json.ok !== true) {
        throw new Error(json.error?.message || "Não foi possível regerar a exportação SAF-T(AO).");
      }

      setRetryTarget(null);
      await loadHistory();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Não foi possível regerar a exportação SAF-T(AO).";
      setError(text);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Histórico de Exportações SAF-T(AO)</h2>
          <p className="text-xs text-slate-500">Filtros por ano e estado com URL partilhável.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={!canLoad || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </button>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          <span className="mb-1 block">Ano</span>
          <select
            value={selectedYear}
            onChange={(event) => updateFilters({ year: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">Todos</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-600">
          <span className="mb-1 block">Status</span>
          <select
            value={selectedStatus}
            onChange={(event) => updateFilters({ status: event.target.value as FilterStatus })}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">Todos</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="PROCESSING">PROCESSING</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}

      {!canLoad ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Empresa fiscal não definida.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Período</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Diagnóstico</th>
              <th className="px-3 py-2 font-medium">XSD</th>
              <th className="px-3 py-2 font-medium">Hash</th>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const canDownload = ["validated", "submitted", "generated"].includes(item.status);
              const canRetry = ["validated", "failed"].includes(item.status);

              return (
                <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatPeriod(item.periodo_inicio, item.periodo_fim)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{getStatusLabel(item.status)}</td>
                  <td className="max-w-[360px] px-3 py-2 text-[11px] text-slate-600">
                    {item.status === "failed" ? getFailureHint(item) ?? "Falha não detalhada." : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{item.xsd_version}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{shortHash(item.checksum_sha256)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{item.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      {canDownload ? (
                        <button
                          type="button"
                          disabled={downloadingId === item.id}
                          onClick={() => void openDownload(item)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {downloadingId === item.id ? "A abrir..." : "Download"}
                        </button>
                      ) : null}

                      {canRetry ? (
                        <button
                          type="button"
                          disabled={retryingId === item.id}
                          onClick={() => setRetryTarget(item)}
                          className="rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {retryingId === item.id ? "A regerar..." : "Regerar SAF-T"}
                        </button>
                      ) : null}

                      {!canDownload && !canRetry ? (
                        <span className="text-[11px] text-slate-400">Indisponível</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={8}>
                  Sem exportações SAF-T para esta empresa/filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {retryTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-900">Confirmar Regeração SAF-T</h3>
            <p className="mt-2 text-xs text-slate-600">
              O ficheiro SAF-T anterior será substituído para o período {retryTarget.periodo_inicio} até {retryTarget.periodo_fim}.
            </p>
            <p className="mt-1 text-xs font-medium text-red-700">Esta ação é irreversível no histórico do período.</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRetryTarget(null)}
                disabled={retryingId === retryTarget.id}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmRetry()}
                disabled={retryingId === retryTarget.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryingId === retryTarget.id ? "A regerar..." : "Confirmar Regeração"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
