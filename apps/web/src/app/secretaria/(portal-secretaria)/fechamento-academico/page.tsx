"use client";

import { useMemo, useState } from "react";

type Job = {
  run_id: string;
  estado: string;
  fechamento_tipo: "fechar_trimestre" | "fechar_ano";
  created_at?: string;
  finished_at?: string;
  errors?: Array<{ stage?: string; error?: string; matricula_id?: string }>;
  counters?: Record<string, number>;
  snapshot_summary?: { aberto: number; fechado: number; reaberto: number };
  steps?: Array<{ etapa: string; status: string; created_at: string; error_message?: string | null }>;
};

export default function FechamentoAcademicoPage() {
  const [acao, setAcao] = useState<"fechar_trimestre" | "fechar_ano">("fechar_trimestre");
  const [anoLetivoId, setAnoLetivoId] = useState("");
  const [periodoLetivoId, setPeriodoLetivoId] = useState("");
  const [turmaIds, setTurmaIds] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [retryReasonByRun, setRetryReasonByRun] = useState<Record<string, string>>({});

  const turmaArray = useMemo(() => turmaIds.split(",").map((x) => x.trim()).filter(Boolean), [turmaIds]);

  const loadJobs = async () => {
    const url = new URL("/api/secretaria/fechamento-academico", window.location.origin);
    if (anoLetivoId) url.searchParams.set("ano_letivo_id", anoLetivoId);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar execuções");
    setJobs(json.jobs ?? []);
  };

  const loadTelemetry = async () => {
    const res = await fetch("/api/secretaria/fechamento-academico/telemetria?days=30", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar telemetria");
    setTelemetry(json);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadJobs(), loadTelemetry()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const iniciar = async () => {
    if (!anoLetivoId) return setError("ano_letivo_id é obrigatório");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/secretaria/fechamento-academico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao,
          ano_letivo_id: anoLetivoId,
          periodo_letivo_id: periodoLetivoId || undefined,
          turma_ids: turmaArray,
          motivo: motivo || undefined,
          executar_assincrono: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao iniciar fechamento");
      await refreshAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const retryRun = async (runId: string) => {
    const reason = retryReasonByRun[runId] || "";
    if (!reason.trim()) return setError("motivo_reabertura é obrigatório para retry");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/secretaria/fechamento-academico", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          retry_failed_only: true,
          motivo_reabertura: reason,
          executar_assincrono: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao reprocessar execução");
      await refreshAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Painel Operacional de Fechamento Académico</h1>
        <p className="text-sm text-slate-500">
          Executa fechamento assíncrono em escala, acompanha progresso por run e expõe telemetria executiva da transição.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Iniciar novo fechamento</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded border p-2" value={acao} onChange={(e) => setAcao(e.target.value as any)}>
            <option value="fechar_trimestre">Fechar trimestre</option>
            <option value="fechar_ano">Fechar ano</option>
          </select>
          <input className="rounded border p-2" placeholder="ano_letivo_id" value={anoLetivoId} onChange={(e) => setAnoLetivoId(e.target.value)} />
          <input className="rounded border p-2" placeholder="periodo_letivo_id (opcional)" value={periodoLetivoId} onChange={(e) => setPeriodoLetivoId(e.target.value)} />
          <input className="rounded border p-2" placeholder="turma_ids separados por vírgula" value={turmaIds} onChange={(e) => setTurmaIds(e.target.value)} />
          <input className="rounded border p-2 md:col-span-2" placeholder="motivo operacional (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-white" disabled={loading} onClick={iniciar}>Iniciar (assíncrono)</button>
          <button className="rounded border px-3 py-2" disabled={loading} onClick={refreshAll}>Atualizar painel</button>
          <a className="rounded border px-3 py-2" href="/secretaria/fechamento-academico/sanidade">Abrir sanidade</a>
        </div>
      </section>

      {telemetry ? (
        <section className="grid gap-3 md:grid-cols-4">
          <Card label="Runs (30d)" value={telemetry.summary?.total_runs ?? 0} />
          <Card label="Taxa de sucesso" value={`${telemetry.summary?.success_rate_percent ?? 0}%`} />
          <Card label="Tempo médio" value={telemetry.summary?.avg_duration_minutes ? `${telemetry.summary.avg_duration_minutes} min` : "-"} />
          <Card label="Processando" value={telemetry.summary?.processing_runs ?? 0} />
        </section>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-semibold">Execuções recentes</h2>
        {jobs.length === 0 ? <p className="text-sm text-slate-500">Sem execuções carregadas.</p> : null}
        {jobs.map((job) => (
          <article key={job.run_id} className="rounded-xl border bg-white p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{job.fechamento_tipo} · {job.run_id}</p>
                <p className="text-xs text-slate-500">Estado: {job.estado} · Criado em {job.created_at ? new Date(job.created_at).toLocaleString("pt-PT") : "-"}</p>
              </div>
              <span className="text-xs rounded bg-slate-100 px-2 py-1">snapshot: A{job.snapshot_summary?.aberto ?? 0}/F{job.snapshot_summary?.fechado ?? 0}/R{job.snapshot_summary?.reaberto ?? 0}</span>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer">Detalhes de etapas e erros</summary>
              <ul className="mt-2 list-disc pl-6 text-xs">
                {(job.steps ?? []).map((s, idx) => (
                  <li key={`${s.etapa}-${idx}`}>{s.etapa}: {s.status}{s.error_message ? ` — ${s.error_message}` : ""}</li>
                ))}
              </ul>
              {(job.errors ?? []).length > 0 ? (
                <ul className="mt-2 list-disc pl-6 text-xs text-rose-700">
                  {(job.errors ?? []).map((e, idx) => (
                    <li key={idx}>{e.stage}: {e.error}</li>
                  ))}
                </ul>
              ) : null}
            </details>

            {job.estado === "FAILED" ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border p-2 text-sm"
                  placeholder="Motivo de reabertura para retry"
                  value={retryReasonByRun[job.run_id] ?? ""}
                  onChange={(e) => setRetryReasonByRun((prev) => ({ ...prev, [job.run_id]: e.target.value }))}
                />
                <button className="rounded bg-amber-600 px-3 py-2 text-white text-sm" disabled={loading} onClick={() => retryRun(job.run_id)}>
                  Reprocessar
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
