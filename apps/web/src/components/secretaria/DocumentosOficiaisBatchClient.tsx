"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  RefreshCw,
  Archive,
  ExternalLink,
  Eye,
  NotebookPen,
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { ModalShell } from "@/components/ui/ModalShell";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";

type TurmaItem = {
  id: string;
  nome: string;
  turma_codigo?: string | null;
  curso: string;
  turno: string;
  ano_letivo: number | null;
  classe: string;
  status_validacao: string | null;
  status_fecho: string;
  pendencias: number;
  alunos: number;
};

type PeriodoItem = { id: string; numero: number; tipo: string };

type JobItem = {
  id: string;
  tipo: string;
  periodo_letivo_id: string | null;
  status: string;
  total_turmas: number;
  processed: number;
  success_count: number;
  failed_count: number;
  zip_path?: string | null;
  error_message?: string | null;
  created_at: string;
  download_url?: string | null;
};

type ToastState = { message: string; type: "success" | "error" } | null;

import { PendenciaItem, PendenciaTipo } from "~types/pendencia";

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${
        toast.type === "success" ? "bg-[#1F6B3B] text-white" : "bg-rose-600 text-white"
      }`}
    >
      {toast.message}
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100">
        <Check size={14} />
      </button>
    </div>
  );
}

export default function DocumentosOficiaisBatchClient() {
  const { escolaId } = useEscolaId();
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [periodoId, setPeriodoId] = useState<string>("");
  const [tipo, setTipo] = useState<"trimestral" | "anual">("trimestral");
  const [hidePendencias, setHidePendencias] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [turmasError, setTurmasError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [optimisticJob, setOptimisticJob] = useState<"RUNNING" | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestJobStatusRef = useRef<string | null>(null);
  const optimisticJobRef = useRef<"RUNNING" | null>(null);
  const pollTokenRef = useRef<number>(0);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [pendenciasModalOpen, setPendenciasModalOpen] = useState(false);
  const [notasModalOpen, setNotasModalOpen] = useState(false);
  const [activeTurma, setActiveTurma] = useState<TurmaItem | null>(null);
  const [pendenciasLoading, setPendenciasLoading] = useState(false);
  const [pendencias, setPendencias] = useState<PendenciaItem[]>([]);
  const [selectedPendencia, setSelectedPendencia] = useState<PendenciaItem | null>(null);

  const pendingPeriodoNumeros = useMemo(() => {
    const numeros = new Set<number>();
    for (const row of pendencias) {
      if (typeof row.trimestre === "number") {
        numeros.add(row.trimestre);
      }
    }
    return Array.from(numeros);
  }, [pendencias]);

  const filteredTurmas = useMemo(() => {
    return hidePendencias ? turmas.filter((t) => t.pendencias === 0) : turmas;
  }, [hidePendencias, turmas]);

  const selectableTurmas = useMemo(() => {
    return filteredTurmas.filter((t) => t.pendencias === 0);
  }, [filteredTurmas]);

  const allSelected = selectableTurmas.length > 0 && selectableTurmas.every((t) => selected.has(t.id));

  const toggleTurma = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableTurmas.map((t) => t.id)));
  };

  const loadTurmas = useCallback(async () => {
    setLoading(true);
    setTurmasError(null);
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/turmas", { cache: "no-store" });
      if (res.status === 429) throw new Error("Muitos pedidos. Aguarde uns segundos.");
      if (res.status === 503) throw new Error("Servidor ocupado. A tentar novamente…");
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setTurmas(json.items || []);
      } else {
        throw new Error(json?.error || "Falha ao carregar turmas");
      }
    } catch (e: any) {
      setTurmasError(e?.message || "Falha ao carregar turmas");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeriodos = useCallback(async () => {
    if (!escolaId) return;
    const res = await fetch(`/api/escola/${escolaId}/admin/periodos-letivos`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && Array.isArray(json.periodos)) {
      const list = json.periodos.filter((p: any) => p.tipo === "TRIMESTRE");
      setPeriodos(list);
      if (!periodoId && list.length > 0) setPeriodoId(list[0].id);
    }
  }, [escolaId, periodoId]);

  const loadJobs = useCallback(async () => {
    setJobsError(null);
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/lote", { cache: "no-store" });
      if (res.status === 429) throw new Error("Muitos pedidos. Aguarde uns segundos.");
      if (res.status === 503) throw new Error("Servidor ocupado. A tentar novamente…");
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setJobs(json.items || []);
      } else {
        throw new Error(json?.error || "Falha ao carregar lotes");
      }
    } catch (e: any) {
      setJobsError(e?.message || "Falha ao carregar lotes");
    }
  }, []);

  useEffect(() => {
    loadTurmas();
    loadPeriodos();
    loadJobs();
  }, [loadTurmas, loadPeriodos, loadJobs]);

  const latestJob = jobs[0] ?? null;
  const effectiveStatus = optimisticJob ?? (latestJob?.status === "PROCESSING" ? "RUNNING" : latestJob?.status === "SUCCESS" ? "DONE" : latestJob?.status === "FAILED" ? "FAILED" : "IDLE");

  useEffect(() => {
    latestJobStatusRef.current = latestJob?.status ?? null;
  }, [latestJob?.status]);

  useEffect(() => {
    optimisticJobRef.current = optimisticJob;
  }, [optimisticJob]);

  useEffect(() => {
    const isProcessing =
      optimisticJobRef.current === "RUNNING" || latestJobStatusRef.current === "PROCESSING";

    if (!isProcessing && !manualRefresh) {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      return;
    }

    const token = Date.now();
    pollTokenRef.current = token;

    const poll = async (attempt = 0) => {
      if (pollTokenRef.current !== token) return;
      await loadJobs();
      if (pollTokenRef.current !== token) return;
      const stillProcessing =
        optimisticJobRef.current === "RUNNING" || latestJobStatusRef.current === "PROCESSING";
      if (!stillProcessing) {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        return;
      }
      const delay = Math.min(3000 * Math.pow(1.5, attempt), 15000);
      pollTimeoutRef.current = setTimeout(() => poll(attempt + 1), delay);
    };

    poll(0);
    if (manualRefresh) setManualRefresh(false);

    return () => {
      pollTokenRef.current = 0;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [loadJobs, manualRefresh]);

  useEffect(() => {
    if (latestJob?.status && latestJob.status !== "PROCESSING") {
      setOptimisticJob(null);
    }
  }, [latestJob?.status]);

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    if (tipo === "trimestral" && !periodoId) {
      setToast({ message: "Selecione o trimestre.", type: "error" });
      return;
    }
    if (tipo !== "trimestral" && tipo !== "anual") {
      setToast({ message: "Tipo ainda não disponível.", type: "error" });
      return;
    }
    setSubmitting(true);
    setOptimisticJob("RUNNING");
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_ids: Array.from(selected),
          tipo,
          periodo_letivo_id: tipo === "trimestral" ? periodoId : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao gerar lote");
      }
      setToast({ message: "Lote iniciado. Acompanhe o progresso abaixo.", type: "success" });
      setSelected(new Set());
      loadJobs();
    } catch (e: any) {
      setToast({ message: e?.message || "Falha ao gerar lote", type: "error" });
      setOptimisticJob(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/lote/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao reprocessar lote");
      }
      setToast({ message: "Lote reprocessado. Acompanhe o progresso.", type: "success" });
      loadJobs();
    } catch (e: any) {
      setToast({ message: e?.message || "Falha ao reprocessar", type: "error" });
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleCancel = async (jobId: string) => {
    setCancellingJobId(jobId);
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/lote/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao cancelar lote");
      }
      setToast({ message: "Lote cancelado.", type: "success" });
      setOptimisticJob(null);
      loadJobs();
    } catch (e: any) {
      setToast({ message: e?.message || "Falha ao cancelar", type: "error" });
    } finally {
      setCancellingJobId(null);
    }
  };

  const handleOpenPendencias = async (turma: TurmaItem) => {
    setActiveTurma(turma);
    setSelectedPendencia(null);
    setPendenciasModalOpen(true);
    setPendenciasLoading(true);
    try {
      const res = await fetch(`/api/secretaria/documentos-oficiais/turmas/${turma.id}/pendencias`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setPendencias(json.items || []);
      } else {
        setPendencias([]);
        setToast({ message: json?.error || "Falha ao carregar pendências", type: "error" });
      }
    } finally {
      setPendenciasLoading(false);
    }
  };

  const handleOpenNotas = (turma: TurmaItem, pendencia?: PendenciaItem | null) => {
    setActiveTurma(turma);
    setSelectedPendencia(pendencia ?? null);
    setNotasModalOpen(true);
  };

  const handleDownloadRascunho = (turmaId: string) => {
    if (tipo === "trimestral") {
      if (!periodoId) {
        setToast({ message: "Selecione o trimestre.", type: "error" });
        return;
      }
      const params = new URLSearchParams({ periodoLetivoId: periodoId });
      window.open(`/api/secretaria/turmas/${turmaId}/pauta-geral?${params.toString()}`, "_blank");
      return;
    }
    window.open(`/api/secretaria/turmas/${turmaId}/pauta-anual`, "_blank");
  };

  const handleDownloadModelo = (turmaId: string) => {
    if (tipo === "trimestral") {
      if (!periodoId) {
        setToast({ message: "Selecione o trimestre.", type: "error" });
        return;
      }
      const periodo = periodos.find((p) => p.id === periodoId)?.numero ?? 1;
      const params = new URLSearchParams({ periodoNumero: String(periodo) });
      window.open(`/api/secretaria/turmas/${turmaId}/pauta-geral/modelo?${params.toString()}`, "_blank");
      return;
    }
    window.open(`/api/secretaria/turmas/${turmaId}/pauta-anual/modelo`, "_blank");
  };

  const periodoNumero = useMemo(() => {
    return periodos.find((p) => p.id === periodoId)?.numero ?? 1;
  }, [periodoId, periodos]);

  const defaultPeriodoNumero = useMemo(() => {
    if (tipo !== "anual") return periodoNumero;
    const maxPeriodo = periodos.reduce((acc, p) => Math.max(acc, p.numero ?? 1), 1);
    return maxPeriodo;
  }, [periodoNumero, periodos, tipo]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
            <Archive className="text-[#1F6B3B] w-6 h-6" />
            Emissão em Lote (Oficial)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gere as pautas de classificação em massa para arquivo físico e envio ao MED.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "trimestral" | "anual")}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#1F6B3B]/20"
          >
            <option value="trimestral">Pauta Trimestral</option>
            <option value="anual">Pauta Anual</option>
            <option value="boletim" disabled>Boletins (em breve)</option>
            <option value="certificado" disabled>Certificados (em breve)</option>
          </select>
          <button
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            type="button"
          >
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>
      </div>

      {(turmasError || jobsError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {turmasError || jobsError}
        </div>
      )}

      {effectiveStatus !== "IDLE" && !(effectiveStatus === "FAILED" && latestJob?.error_message?.toLowerCase().includes("cancelado")) && (
        <div
          className={`p-5 rounded-xl border flex items-center justify-between shadow-sm transition-all ${
            effectiveStatus === "RUNNING" ? "bg-blue-50 border-blue-100" :
            effectiveStatus === "DONE" ? "bg-[#1F6B3B]/10 border-[#1F6B3B]/20" :
            "bg-rose-50 border-rose-100"
          }`}
        >
          <div className="flex items-center gap-4">
            {effectiveStatus === "RUNNING" ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            ) : effectiveStatus === "DONE" ? (
              <CheckCircle2 className="w-6 h-6 text-[#1F6B3B]" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-600" />
            )}
            <div>
              <h3
                className={`font-bold text-sm ${
                  effectiveStatus === "RUNNING" ? "text-blue-900" :
                  effectiveStatus === "DONE" ? "text-[#1F6B3B]" :
                  "text-rose-700"
                }`}
              >
                {effectiveStatus === "RUNNING"
                  ? "A processar lote de pautas..."
                  : effectiveStatus === "DONE"
                  ? "Lote processado com sucesso!"
                  : "Falha ao processar lote."}
              </h3>
              <p className="text-xs mt-0.5 opacity-80">
                {effectiveStatus === "RUNNING"
                  ? "Pode navegar noutras abas. O sistema avisará quando o ZIP estiver pronto."
                  : effectiveStatus === "DONE"
                  ? "O ficheiro ZIP com todos os PDFs está pronto para download."
                  : latestJob?.error_message ?? "Reprocesse o lote para tentar novamente."}
              </p>
            </div>
          </div>
          {effectiveStatus === "DONE" && latestJob?.download_url && (
            <a
              href={latestJob.download_url}
              className="flex items-center gap-2 bg-[#1F6B3B] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1F6B3B]/90"
            >
              <Download className="w-4 h-4" /> Baixar Pautas.zip
            </a>
          )}
          {effectiveStatus === "RUNNING" && latestJob?.id && (
            <button
              type="button"
              onClick={() => handleCancel(latestJob.id)}
              disabled={cancellingJobId === latestJob.id}
              className="flex items-center gap-2 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              {cancellingJobId === latestJob.id ? "Cancelando…" : "Cancelar lote"}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hidePendencias}
            onChange={(e) => setHidePendencias(e.target.checked)}
          />
          Ocultar turmas com pendências de notas
        </label>
        <select
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          disabled={tipo !== "trimestral"}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
        >
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>{`Trimestre ${p.numero}`}</option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400">Boletins e certificados: em breve.</span>
        <button
          type="button"
          onClick={() => setManualRefresh(true)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Atualizar status
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set(selectableTurmas.map((t) => t.id)))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Selecionar turmas prontas
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded text-[#1F6B3B] focus:ring-[#1F6B3B]"
                />
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Turma & Curso</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alunos</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Pedagógico</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pendências</th>
              <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-sm text-slate-500">
                  <RefreshCw className="inline-block h-4 w-4 animate-spin mr-2" /> A carregar turmas…
                </td>
              </tr>
            )}
            {!loading && filteredTurmas.map((turma) => {
              const hasPendencias = turma.pendencias > 0
              const isChecked = selected.has(turma.id)
              return (
                <tr key={turma.id} className={`transition-colors ${isChecked ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={hasPendencias}
                      onChange={() => toggleTurma(turma.id)}
                      className="rounded text-[#1F6B3B] focus:ring-[#1F6B3B] disabled:opacity-50 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{turma.turma_codigo || turma.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{turma.curso} • {turma.ano_letivo ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">{turma.alunos ?? "—"}</td>
                  <td className="px-6 py-4">
                    {hasPendencias ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5" /> Faltam Notas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B] text-xs font-bold border border-[#1F6B3B]/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pronta
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {hasPendencias ? `${turma.pendencias} pendência(s)` : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {hasPendencias && (
                        <button
                          type="button"
                          onClick={() => handleOpenPendencias(turma)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700"
                        >
                          <Eye className="h-3 w-3" /> Pendências
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenNotas(turma)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <NotebookPen className="h-3 w-3" /> Lançar notas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadRascunho(turma.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <FileText className="h-3 w-3" /> Rascunho
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadModelo(turma.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <ExternalLink className="h-3 w-3" /> Modelo
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filteredTurmas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-sm text-slate-400">Nenhuma turma encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Histórico de Lotes</h2>
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-xs">
              <div>
                <p className="font-semibold text-slate-800">
                  {job.tipo === "trimestral" ? "Trimestral" : "Anual"} • {new Date(job.created_at).toLocaleString("pt-PT")}
                </p>
                <p className="text-slate-400">
                  Processadas {job.processed}/{job.total_turmas} • Sucesso {job.success_count} • Falhas {job.failed_count}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  job.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" :
                  job.status === "FAILED" ? "bg-rose-50 text-rose-700" :
                  "bg-amber-50 text-amber-700"
                }`}>
                  {job.status}
                </span>
                {job.download_url && (
                  <a
                    href={job.download_url}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-white"
                  >
                    <Download size={12} /> ZIP
                  </a>
                )}
                {job.status === "FAILED" && (
                  <button
                    onClick={() => handleRetry(job.id)}
                    disabled={retryingJobId === job.id}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-rose-700"
                  >
                    {retryingJobId === job.id ? "Reprocessando…" : "Reprocessar"}
                  </button>
                )}
                {job.status === "PROCESSING" && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    disabled={cancellingJobId === job.id}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-rose-700"
                  >
                    {cancellingJobId === job.id ? "Cancelando…" : "Cancelar"}
                  </button>
                )}
                {!job.download_url && job.status === "PROCESSING" && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <RefreshCw className="h-3 w-3 animate-spin" /> A processar…
                  </span>
                )}
                {job.status === "FAILED" && (
                  <span className="text-rose-600">{job.error_message ?? "Falha"}</span>
                )}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="text-sm text-slate-400">Nenhum lote gerado ainda.</div>
          )}
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <ModalShell
        open={pendenciasModalOpen}
        title={activeTurma ? `Pendências da ${activeTurma.nome}` : "Pendências"}
        description="Resolva avaliações e notas pendentes antes de emitir o oficial."
        onClose={() => {
          setPendenciasModalOpen(false);
          setPendencias([]);
          setSelectedPendencia(null);
        }}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => activeTurma && handleOpenPendencias(activeTurma)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Atualizar pendências
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!activeTurma) return;
                  setPendenciasModalOpen(false);
                  handleOpenNotas(activeTurma, pendencias[0]);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Lançar notas
              </button>
              <button
                type="button"
                onClick={() => activeTurma && handleDownloadRascunho(activeTurma.id)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Baixar rascunho
              </button>
              <button
                type="button"
                onClick={() => activeTurma && handleDownloadModelo(activeTurma.id)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Baixar modelo
              </button>
            </div>
          </div>
        }
      >
        {pendenciasLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" /> Carregando pendências...
          </div>
        ) : pendencias.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Nenhuma pendência encontrada para esta turma.
          </div>
        ) : (
          <div className="space-y-3">
                      {pendencias.flatMap((pendenciaItem) => pendenciaItem.tipos.map((pendenciaTipo) => (
                        <div
                          key={`${pendenciaItem.turma_disciplina_id}-${pendenciaTipo.tipo}-${pendenciaItem.trimestre}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{pendenciaItem.disciplina_nome}</p>
                            <p className="text-xs text-slate-500">
                              {pendenciaTipo.tipo} • Trimestre {pendenciaItem.trimestre ?? "—"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!activeTurma) return;
                                setPendenciasModalOpen(false);
                                handleOpenNotas(activeTurma, pendenciaItem);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                            >
                              <NotebookPen className="h-3 w-3" /> Lançar notas
                            </button>
                            {pendenciaTipo.status === "SEM_AVALIACAO" ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                Sem avaliação
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                {pendenciaTipo.pendentes} nota(s) pendentes
                              </span>
                            )}
                            <p className="text-[11px] text-slate-400">
                              {pendenciaTipo.notas_lancadas}/{pendenciaItem.total_alunos} lançadas
                            </p>
                          </div>
                        </div>
                      )))}          </div>
        )}
      </ModalShell>

      <ModalShell
        open={notasModalOpen}
        title={activeTurma ? `Lançar notas · ${activeTurma.nome}` : "Lançar notas"}
        description="Registre as notas e retorne para emitir os documentos oficiais."
        onClose={() => {
          setNotasModalOpen(false);
          setSelectedPendencia(null);
        }}
      >
        <PautaRapidaModal
          initialTurmaId={activeTurma?.id}
          initialPeriodoNumero={selectedPendencia?.trimestre ?? defaultPeriodoNumero}
          initialDisciplinaId={selectedPendencia?.disciplina_id ?? undefined}
          initialTurmaLabel={activeTurma?.turma_codigo || activeTurma?.nome || "Turma"}
          lockTurma
          showPeriodoTabs={tipo === "anual"}
          pendingPeriodoNumeros={pendingPeriodoNumeros}
          hideNavigation
        />
      </ModalShell>

      {selected.size > 0 && effectiveStatus !== "RUNNING" && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-950 p-3 pr-4 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-8">
          <div className="flex items-center gap-3 pl-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold">
              {selected.size}
            </span>
            <span className="text-sm font-medium text-slate-300">Turmas selecionadas</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="flex items-center gap-2 bg-[#E3B23C] text-slate-950 px-6 py-2.5 rounded-full text-sm font-bold hover:brightness-105 transition-all disabled:opacity-70"
          >
            {submitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> A iniciar...</>
            ) : (
              <><FileText className="w-4 h-4" /> Gerar Lote Oficial (ZIP)</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
