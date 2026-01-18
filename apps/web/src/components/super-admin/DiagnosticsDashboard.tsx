"use client";

import { useEffect, useState } from "react";

type OutboxSummaryEntry = {
  total: number;
  oldest_age_minutes: number | null;
};

type DiagnosticsPayload = {
  ok: boolean;
  outbox?: Record<string, OutboxSummaryEntry>;
  cronRuns?: Array<{
    jobid: number;
    status: string | null;
    start_time: string | null;
    end_time: string | null;
    return_message: string | null;
  }>;
  error?: string;
};

const STATUS_ORDER = ["failed", "processing", "pending", "sent", "dead"] as const;

export default function DiagnosticsDashboard() {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/super-admin/diagnostics");
        const json = (await res.json().catch(() => null)) as DiagnosticsPayload | null;
        if (!active) return;
        if (!res.ok || !json?.ok) {
          setError(json?.error || "Falha ao carregar diagnostics");
          setData(null);
        } else {
          setData(json);
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Erro ao carregar";
        setError(message);
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const outboxEntries = data?.outbox ?? {};
  const outboxStatuses = Array.from(
    new Set([...STATUS_ORDER, ...Object.keys(outboxEntries)])
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnostics</h1>
          <p className="text-sm text-gray-500">Status de outbox, cron e filas críticas.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Recarregar
        </button>
      </header>

      {loading ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">Carregando…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {outboxStatuses.map((status) => {
          const entry = outboxEntries[status] ?? { total: 0, oldest_age_minutes: null };
          return (
            <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase text-gray-400">Outbox · {status}</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{entry.total}</div>
              <div className="mt-1 text-xs text-gray-500">
                {entry.oldest_age_minutes !== null
                  ? `Mais antigo: ${entry.oldest_age_minutes} min`
                  : "Sem itens"}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Cron · Últimas execuções</div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="py-2 pr-4">Job</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Início</th>
                <th className="py-2 pr-4">Fim</th>
                <th className="py-2">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {(data?.cronRuns ?? []).map((run) => (
                <tr key={`${run.jobid}-${run.start_time}`} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{run.jobid}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {run.status ?? "unknown"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{formatDate(run.start_time)}</td>
                  <td className="py-2 pr-4 text-gray-600">{formatDate(run.end_time)}</td>
                  <td className="py-2 text-xs text-gray-500">{run.return_message ?? ""}</td>
                </tr>
              ))}
              {data?.cronRuns?.length ? null : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-gray-400">
                    Sem registros recentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}
