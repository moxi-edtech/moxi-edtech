"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw, UsersRound, BookOpen, UserCheck, Download,
  MoreVertical, UserPlus, FileText, CalendarCheck, Settings,
  School, LayoutDashboard, GraduationCap, MapPin, X,
  AlertCircle, CheckCircle2, Lock, ChevronLeft,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePlanFeature } from "@/hooks/usePlanFeature";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";
import { Skeleton } from "@/components/feedback/FeedbackSystem";

// ─── Design tokens ────────────────────────────────────────────────────────────
//
//  GREEN  → confirmed / healthy / ok states only
//  GOLD   → single primary action per screen ("Matricular") + attention warnings
//  ROSE   → critical states ("Atraso", "Lotado")
//  SLATE  → secondary actions, chrome, neutral UI
//
const T = {
  green:        "#1F6B3B",
  greenLight:   "#1F6B3B18",
  greenBorder:  "#1F6B3B30",
  gold:         "#E3B23C",
  goldLight:    "#E3B23C18",
  rose:         "#e11d48",
  roseLight:    "rgba(225,29,72,0.08)",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Aluno = {
  numero:             number;
  matricula_id:       string;
  aluno_id:           string;
  nome:               string;
  bi:                 string;
  numero_matricula?:  string | number | null;
  status_matricula:   string;
  status_financeiro?: "em_dia" | "atraso";
};

type TurmaData = {
  turma: {
    id:          string;
    escola_id:   string;
    nome:        string;
    classe_id:   string;
    classe_nome: string;
    ano_letivo:  number;
    turno:       string;
    sala:        string | null;
    capacidade:  number;
    ocupacao:    number;
    diretor?:    { id: string; nome: string; email: string } | null;
    curso_nome?: string | null;
  };
  alunos:      Aluno[];
  disciplinas: Array<{
    id:               string;
    nome:             string;
    professor?:       string;
    periodos_ativos?: number[] | null;
    turma_disciplina_id?: string | null;
  }>;
};

type Periodo = {
  id:          string;
  numero:      number;
  tipo:        string;
  data_inicio: string;
  data_fim:    string;
};

type PautaDetalhadaRow = {
  aluno_id: string;
  nome: string;
  foto?: string | null;
  numero_chamada?: number | null;
  mac?: number | null;
  npp?: number | null;
  npt?: number | null;
  mt?: number | null;
};

type ToastState = { message: string; type: "success" | "error" } | null;
type Tab = "alunos" | "pedagogico" | "docs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fetchPautaOficial(url: string) {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    if (json?.status === "PROCESSING") {
      return { status: "PROCESSING" as const }
    }
    throw new Error(json?.error || "Falha ao gerar pauta")
  }
  return json as { download_url?: string; status?: "SUCCESS" }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`
      fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl
      text-sm font-semibold animate-in slide-in-from-bottom-2 duration-200
      ${toast.type === "success" ? "bg-[#1F6B3B] text-white" : "bg-rose-600 text-white"}
    `}>
      {toast.message}
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, message, loading, onConfirm, onCancel }: {
  open: boolean; message: string; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-700">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60 transition-colors">
            {loading ? "A fechar…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade modal ────────────────────────────────────────────────────────────

function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Funcionalidade bloqueada</h3>
            <p className="text-xs text-slate-500 mt-0.5">Disponível em planos superiores.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          A Lista Nominal com QR Code requer um plano que inclua documentos com QR.
          Contacte o suporte para fazer upgrade.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
          <Link href="/planos"
            className="px-4 py-2 rounded-xl bg-[#E3B23C] text-white text-sm font-bold hover:brightness-95 transition-colors">
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Pill tabs ────────────────────────────────────────────────────────────────

function PillTabs({ active, onChange, count }: {
  active:   Tab;
  onChange: (t: Tab) => void;
  count:    number;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "alunos",     label: `Alunos (${count})` },
    { id: "pedagogico", label: "Pedagógico" },
    { id: "docs",       label: "Documentos" },
  ];

  return (
    <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`
            px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
            ${active === id
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Status badges ────────────────────────────────────────────────────────────

function MatriculaBadge({ status }: { status: string }) {
  const ok = ["ativa", "ativo"].includes(status.toLowerCase());
  return (
    <span className={`
      px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border
      ${ok
        ? "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20"
        : "bg-rose-50 text-rose-600 border-rose-100"}
    `}>
      {status}
    </span>
  );
}

function FinanceiroBadge({ status }: { status?: "em_dia" | "atraso" }) {
  if (!status) return <span className="text-[10px] text-slate-400">—</span>;
  return status === "em_dia" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1F6B3B]/10 text-[#1F6B3B] text-[10px] font-bold border border-[#1F6B3B]/20">
      <CheckCircle2 size={9} /> Em dia
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-100">
      <AlertCircle size={9} /> Atraso
    </span>
  );
}

// ─── Aluno row ────────────────────────────────────────────────────────────────

function AlunoRow({ aluno, style }: { aluno: Aluno; style?: React.CSSProperties }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors group" style={style}>
      <td className="px-6 py-4 font-mono text-slate-400 text-xs">
        {String(aluno.numero).padStart(2, "0")}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
            {aluno.nome[0]}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{aluno.nome}</p>
            <p className="text-[10px] text-slate-400">BI: {aluno.bi || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 w-fit">
            {aluno.numero_matricula ?? "—"}
          </span>
          <MatriculaBadge status={aluno.status_matricula || "indefinido"} />
        </div>
      </td>
      <td className="px-6 py-4">
        <FinanceiroBadge status={aluno.status_financeiro} />
      </td>
      <td className="px-6 py-4 text-right">
        <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical size={15} />
        </button>
      </td>
    </tr>
  );
}

// ─── Doc card ─────────────────────────────────────────────────────────────────

function DocCard({ icon: Icon, title, desc, onClick, highlight, locked }: {
  icon:       React.ElementType;
  title:      string;
  desc:       string;
  onClick?:   () => void;
  highlight?: boolean;
  locked?:    boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-5 rounded-xl border transition-all duration-200 flex flex-col items-start gap-3
        group text-left w-full hover:-translate-y-0.5
        ${highlight
          ? "bg-[#1F6B3B] border-[#1F6B3B] hover:shadow-lg hover:shadow-green-900/20"
          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
        }
      `}
    >
      {locked && (
        <span className="absolute top-3 right-3 p-1 rounded-md bg-black/10">
          <Lock size={10} className={highlight ? "text-white/60" : "text-slate-400"} />
        </span>
      )}

      <div className={`p-2.5 rounded-xl transition-colors ${
        highlight ? "bg-white/15" : "bg-slate-100 group-hover:bg-slate-200"
      }`}>
        <Icon size={18} className={highlight ? "text-white" : "text-slate-600"} />
      </div>

      <div>
        <h4 className={`font-bold text-sm ${highlight ? "text-white" : "text-slate-800"}`}>{title}</h4>
        <p className={`text-xs mt-0.5 leading-relaxed ${highlight ? "text-white/70" : "text-slate-500"}`}>{desc}</p>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TurmaDetailClient({ turmaId }: { turmaId: string }) {
  const [activeTab,     setActiveTab]     = useState<Tab>("alunos");
  const [data,          setData]          = useState<TurmaData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [periodos,      setPeriodos]      = useState<Periodo[]>([]);
  const [periodoId,     setPeriodoId]     = useState("");
  const [periodoNumero, setPeriodoNumero] = useState<number>(1);
  const [periodoClosed, setPeriodoClosed] = useState(false);
  const [pautaGeralLoading, setPautaGeralLoading] = useState(false);
  const [pautaAnualLoading, setPautaAnualLoading] = useState(false);
  const [closing,       setClosing]       = useState(false);
  const [toast,         setToast]         = useState<ToastState>(null);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [upgradeOpen,   setUpgradeOpen]   = useState(false);
  const [actionModal,   setActionModal]   = useState<
    | null
    | {
        type: "notas" | "professor";
        disciplina: { id: string; nome: string; professor?: string | null; turma_disciplina_id?: string | null };
      }
  >(null);
  const [notasPeriodoNumero, setNotasPeriodoNumero] = useState<number>(1);
  const [notasLoading, setNotasLoading] = useState(false);
  const [notasPauta, setNotasPauta] = useState<StudentGradeRow[]>([]);
  const [notasInitial, setNotasInitial] = useState<StudentGradeRow[]>([]);
  const [notasError, setNotasError] = useState<string | null>(null);
  const [notasSaving, setNotasSaving] = useState(false);

  const alunosScrollRef               = useRef<HTMLDivElement | null>(null);
  const { isEnabled: canQrDocs }      = usePlanFeature("doc_qr_code");
  const alunos                        = data?.alunos ?? [];

  const alunosVirtualizer = useVirtualizer({
    count:            alunos.length,
    getScrollElement: () => alunosScrollRef.current,
    estimateSize:     () => 64,
    overscan:         6,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res  = await fetch(`/api/secretaria/turmas/${turmaId}/detalhes`);
        if (!res.ok) throw new Error("Falha ao carregar dados da turma.");
        const json = await res.json();
        setData(json.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [turmaId]);

  const escolaId = data?.turma.escola_id;

  useEffect(() => {
    if (!escolaId || !turmaId) return;
    async function fetchPeriodos() {
      const res  = await fetch(
        `/api/escola/${escolaId}/admin/periodos-por-turma?turma_id=${encodeURIComponent(turmaId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        const items: Periodo[] = json.items || [];
        setPeriodos(items);
        if (items.length > 0) {
          setPeriodoId(items[0].id);
          setPeriodoNumero(items[0].numero);
        }
      }
    }
    fetchPeriodos();
  }, [escolaId, turmaId]);

  useEffect(() => {
    const selected = periodos.find((p) => p.id === periodoId);
    if (selected) setPeriodoNumero(selected.numero);
  }, [periodoId, periodos]);

  useEffect(() => {
    if (actionModal?.type !== "notas") return;
    if (periodoNumero) setNotasPeriodoNumero(periodoNumero);
  }, [actionModal, periodoNumero]);

  useEffect(() => {
    if (actionModal?.type !== "notas") return;
    if (!turmaId || !actionModal.disciplina?.id) return;

    let active = true;
    const load = async () => {
      setNotasLoading(true);
      setNotasError(null);
      try {
        const params = new URLSearchParams({
          disciplinaId: actionModal.disciplina.id,
          trimestre: String(notasPeriodoNumero),
        });
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok && Array.isArray(json.items)) {
          const mapped = (json.items as PautaDetalhadaRow[]).map((row, index) => ({
            id: row.aluno_id,
            numero: row.numero_chamada ?? index + 1,
            nome: row.nome,
            foto: row.foto ?? null,
            mac1: row.mac ?? null,
            npp1: row.npp ?? null,
            npt1: row.npt ?? null,
            mt1: row.mt ?? null,
            _status: "synced" as const,
          }));
          setNotasInitial(mapped);
          setNotasPauta(mapped);
        } else {
          setNotasInitial([]);
          setNotasPauta([]);
        }
      } catch (e: any) {
        if (active) setNotasError(e?.message || "Erro ao carregar pauta");
      } finally {
        if (active) setNotasLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [actionModal, turmaId, notasPeriodoNumero]);

  useEffect(() => {
    if (!escolaId || !turmaId || !periodoId) { setPeriodoClosed(false); return; }
    async function fetchStatus() {
      const res  = await fetch(
        `/api/escola/${escolaId}/admin/frequencias/fechar-periodo?turma_id=${encodeURIComponent(turmaId)}&periodo_letivo_id=${encodeURIComponent(periodoId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setPeriodoClosed(Boolean(json.closed));
    }
    fetchStatus();
  }, [escolaId, turmaId, periodoId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleListaPdf = () => {
    if (!canQrDocs) { setUpgradeOpen(true); return; }
    window.open(`/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf`, "_blank");
  };

  const handleClosePeriodoConfirmed = useCallback(async () => {
    if (!escolaId || !turmaId || !periodoId) return;
    setClosing(true);
    try {
      const res  = await fetch(`/api/escola/${escolaId}/admin/frequencias/fechar-periodo`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ turma_id: turmaId, periodo_letivo_id: periodoId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao fechar período");
      setPeriodoClosed(true);
      setConfirmOpen(false);
      setToast({ message: "Período fechado com sucesso.", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message || "Erro ao fechar período.", type: "error" });
    } finally {
      setClosing(false);
    }
  }, [escolaId, turmaId, periodoId]);

  const handleSaveNotas = useCallback(async (rows: StudentGradeRow[]) => {
    if (actionModal?.type !== "notas") return;
    if (!turmaId || !actionModal.disciplina?.id) return;
    setNotasSaving(true);
    try {
      const payloads = [
        { tipo: "MAC", campo: "mac1" as const },
        { tipo: "NPP", campo: "npp1" as const },
        { tipo: "NPT", campo: "npt1" as const },
      ];

      for (const { tipo, campo } of payloads) {
        const notas = rows
          .map((row) => ({ aluno_id: row.id, valor: row[campo] }))
          .filter((entry) => typeof entry.valor === "number");
        if (notas.length === 0) continue;

        const idempotencyKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const res = await fetch(`/api/secretaria/notas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            turma_id: turmaId,
            disciplina_id: actionModal.disciplina.id,
            turma_disciplina_id: actionModal.disciplina.turma_disciplina_id || undefined,
            trimestre: notasPeriodoNumero,
            tipo_avaliacao: tipo,
            notas,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao salvar notas");
      }

      setNotasPauta((prev) =>
        prev.map((row) => {
          const updated = rows.find((candidate) => candidate.id === row.id);
          return updated ? { ...row, ...updated, _status: "synced" } : row;
        })
      );
    } finally {
      setNotasSaving(false);
    }
  }, [actionModal, turmaId, notasPeriodoNumero]);

  const handleDownloadPautaGeralOficial = useCallback(async () => {
    if (!periodoId) return
    setPautaGeralLoading(true)
    try {
      const json = await fetchPautaOficial(
        `/api/secretaria/turmas/${turmaId}/pauta-geral/oficial?periodo_letivo_id=${encodeURIComponent(periodoId)}&mode=json`
      )
      if ((json as any).status === "PROCESSING") {
        setToast({ message: "Pauta em processamento. Aguarde.", type: "success" })
        return
      }
      if ('download_url' in json && json.download_url) triggerDownload(json.download_url)
    } catch (e: any) {
      setToast({ message: e?.message || "Falha ao gerar pauta", type: "error" })
    } finally {
      setPautaGeralLoading(false)
    }
  }, [periodoId, turmaId])

  const handleDownloadPautaAnualOficial = useCallback(async () => {
    if (!periodoId) return
    setPautaAnualLoading(true)
    try {
      const json = await fetchPautaOficial(
        `/api/secretaria/turmas/${turmaId}/pauta-anual/oficial?periodo_letivo_id=${encodeURIComponent(periodoId)}&mode=json`
      )
      if ((json as any).status === "PROCESSING") {
        setToast({ message: "Pauta em processamento. Aguarde.", type: "success" })
        return
      }
      if ('download_url' in json && json.download_url) triggerDownload(json.download_url)
    } catch (e: any) {
      setToast({ message: e?.message || "Falha ao gerar pauta", type: "error" })
    } finally {
      setPautaAnualLoading(false)
    }
  }, [periodoId, turmaId])

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
    </div>
  );

  if (error) return (
    <div className="m-6 p-5 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-100 text-sm font-bold">
      {error}
    </div>
  );

  if (!data) return null;

  const { turma, disciplinas } = data;

  const disciplinasFiltradas = disciplinas.filter((d) => {
    if (!d.periodos_ativos?.length) return true;
    return d.periodos_ativos.includes(periodoNumero);
  });

  const max         = Math.max(turma.capacidade, 1);
  const ocupacaoPct = Math.min((turma.ocupacao / max) * 100, 100);
  const ocupacaoBar = ocupacaoPct >= 100 ? "bg-rose-500"
    : ocupacaoPct >= 80 ? "bg-[#E3B23C]"
    : "bg-white/80";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ── HERO — dark green, strong identity ───────────────────────────── */}
      <div className="bg-[#1F6B3B] text-white">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-8">

          {/* Breadcrumb */}
          <Link
            href="/secretaria/turmas"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium mb-6 transition-colors"
          >
            <ChevronLeft size={14} /> Turmas
          </Link>

          {/* Identity row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar — white on green */}
              <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <span className="text-2xl font-black tracking-tighter text-white">
                  {turma.nome.substring(0, 2).toUpperCase()}
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">{turma.nome}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {[
                    { icon: School,        label: turma.classe_nome },
                    turma.curso_nome ? { icon: GraduationCap, label: turma.curso_nome } : null,
                    { icon: CalendarCheck, label: turma.turno },
                    { icon: MapPin,        label: `Sala ${turma.sala || "N/D"}` },
                  ].filter(Boolean).map(({ icon: Icon, label }: any) => (
                    <span key={label}
                      className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg text-xs font-medium text-white/80">
                      <Icon size={11} /> {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions — settings subtle, matricular gold */}
            <div className="flex gap-3 flex-shrink-0">
              <button className="p-2.5 bg-white/10 border border-white/20 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <Settings size={17} />
              </button>
              <Link
                href={`/secretaria/admissoes/nova?turmaId=${turma.id}`}
                className="flex items-center gap-2 bg-[#E3B23C] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-95 transition-all shadow-lg shadow-black/20 active:scale-95"
              >
                <UserPlus size={16} /> Matricular
              </Link>
            </div>
          </div>

          {/* ── Stat strip — inside hero, white/translucent ─────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">

            {/* Ocupação */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Capacidade</p>
                <UsersRound size={14} className="text-white/40" />
              </div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-2xl font-black text-white">{turma.ocupacao}</span>
                <span className="text-sm text-white/50">/ {turma.capacidade}</span>
                <span className={`ml-auto text-xs font-bold ${
                  ocupacaoPct >= 100 ? "text-rose-300" :
                  ocupacaoPct >= 80  ? "text-[#E3B23C]" : "text-white/60"
                }`}>
                  {Math.round(ocupacaoPct)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${ocupacaoBar}`}
                  style={{ width: `${ocupacaoPct}%` }} />
              </div>
            </div>

            {/* Diretor */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Diretor de Turma</p>
                <UserCheck size={14} className="text-white/40" />
              </div>
              {turma.diretor ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {turma.diretor.nome[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{turma.diretor.nome}</p>
                    <p className="text-[10px] text-white/50 truncate">{turma.diretor.email}</p>
                  </div>
                </div>
              ) : (
                <button className="text-xs font-bold text-[#E3B23C] hover:underline flex items-center gap-1.5 mt-1">
                  <UserPlus size={12} /> Atribuir professor
                </button>
              )}
            </div>

            {/* Ano letivo */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Ano Letivo</p>
                <CalendarCheck size={14} className="text-white/40" />
              </div>
              <p className="text-2xl font-black text-white">{turma.ano_letivo}</p>
              <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                Em andamento
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab bar — sits at bottom of hero, transitions into content ── */}
        <div className="max-w-7xl mx-auto px-6 pb-0">
          <div className="flex items-center justify-between border-t border-white/10 pt-4 pb-0">
            <PillTabs
              active={activeTab}
              onChange={setActiveTab}
              count={alunos.length}
            />
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Alunos */}
        {activeTab === "alunos" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="overflow-x-auto">
              <div ref={alunosScrollRef} className="max-h-[600px] overflow-y-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <thead
                    className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10"
                    style={{ display: "table", width: "100%", tableLayout: "fixed" }}
                  >
                    <tr>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-14">Nº</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estudante</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Matrícula</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Financeiro</th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16">—</th>
                    </tr>
                  </thead>
                  <tbody
                    className="divide-y divide-slate-50"
                    style={alunos.length > 0 ? {
                      position: "relative", display: "block",
                      height: alunosVirtualizer.getTotalSize(),
                    } : undefined}
                  >
                    {alunos.length === 0 ? (
                      <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                        <td colSpan={5} className="py-16 text-center">
                          <p className="text-sm text-slate-400">Nenhum aluno matriculado nesta turma.</p>
                        </td>
                      </tr>
                    ) : (
                      alunosVirtualizer.getVirtualItems().map((vr) => (
                        <AlunoRow
                          key={alunos[vr.index].aluno_id}
                          aluno={alunos[vr.index]}
                          style={{
                            position: "absolute", top: 0, left: 0,
                            transform: `translateY(${vr.start}px)`,
                            width: "100%", display: "table", tableLayout: "fixed",
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Pedagógico */}
        {activeTab === "pedagogico" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">

            {/* Fechamento de frequência */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Fechamento de Frequência</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione o período e confirme o fechamento.</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  periodoClosed
                    ? "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {periodoClosed ? <><CheckCircle2 size={11} /> Fechado</> : "Aberto"}
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <select
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                  disabled={periodos.length === 0}
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20 cursor-pointer disabled:opacity-60 transition-all"
                >
                  <option value="">Selecione o período</option>
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tipo} {p.numero} ({p.data_inicio} → {p.data_fim})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={closing || !periodoId || periodoClosed}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-slate-800 transition-colors"
                >
                  {closing ? "A fechar…" : "Fechar período"}
                </button>
              </div>

              {periodos.length === 0 && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle size={11} /> Nenhum período encontrado para este ano letivo.
                </p>
              )}
            </div>

            {/* Disciplinas */}
            {disciplinasFiltradas.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">Nenhuma disciplina ativa neste período.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {disciplinasFiltradas.map((d) => (
                  <div key={d.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#1F6B3B]/30 hover:shadow-md transition-all group cursor-pointer">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-[#1F6B3B]/10 group-hover:text-[#1F6B3B] w-fit transition-colors mb-4">
                      <BookOpen size={16} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{d.nome}</h4>
                    <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                      <UserCheck size={11} className="flex-shrink-0" />
                      {d.professor
                        ? <span className="truncate">{d.professor}</span>
                        : <span className="text-amber-600 font-semibold">Professor N/D</span>
                      }
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        className="w-full py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors"
                        onClick={() =>
                          setActionModal({
                            type: "notas",
                            disciplina: {
                              id: d.id,
                              nome: d.nome,
                              professor: d.professor ?? null,
                              turma_disciplina_id: d.turma_disciplina_id ?? null,
                            },
                          })
                        }
                      >
                        Gerenciar Notas
                      </button>
                      {!d.professor && (
                        <button
                          className="w-full py-2 text-xs font-bold bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                          onClick={() =>
                            setActionModal({
                              type: "professor",
                              disciplina: {
                                id: d.id,
                                nome: d.nome,
                                professor: d.professor ?? null,
                                turma_disciplina_id: d.turma_disciplina_id ?? null,
                              },
                            })
                          }
                        >
                          Atribuir Professor
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documentos */}
        {activeTab === "docs" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="mb-5">
              <h3 className="text-sm font-bold text-slate-900">Central de Documentos</h3>
              <p className="text-xs text-slate-400 mt-0.5">Exporte documentos oficiais desta turma.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DocCard
                icon={Download}
                title="Pauta Digital (Excel)"
                desc="Planilha oficial para lançamento offline de notas."
                onClick={() => triggerDownload(`/api/secretaria/turmas/${turmaId}/pauta`)}
                highlight
              />
              <DocCard
                icon={FileText}
                title="Lista Nominal"
                desc="Relatório PDF oficial da turma com QR Code."
                onClick={handleListaPdf}
                locked={!canQrDocs}
              />
              <DocCard
                icon={LayoutDashboard}
                title="Pauta em Branco"
                desc="Grelha vazia para preenchimento manual."
                onClick={() => triggerDownload(`/api/secretaria/turmas/${turmaId}/pauta-branca`)}
              />
              <DocCard
                icon={BookOpen}
                title="Mini-Pautas"
                desc="Fichas individuais por disciplina."
                onClick={() => triggerDownload(`/api/secretaria/turmas/${turmaId}/mini-pautas`)}
              />
              <DocCard
                icon={FileText}
                title="Pauta Geral (Rascunho)"
                desc="Documento completo do trimestre atual."
                onClick={periodoId
                  ? () => triggerDownload(
                      `/api/secretaria/turmas/${turmaId}/pauta-geral?periodo_letivo_id=${encodeURIComponent(periodoId)}&periodoNumero=${encodeURIComponent(String(periodoNumero))}`
                    )
                  : undefined
                }
                locked={!periodoId}
              />
              <DocCard
                icon={FileText}
                title="Modelo Pauta Geral"
                desc="Modelo vazio para apresentação."
                onClick={() => triggerDownload(
                  `/api/secretaria/turmas/${turmaId}/pauta-geral/modelo?periodoNumero=${encodeURIComponent(String(periodoNumero))}`
                )}
              />
              <DocCard
                icon={Download}
                title={pautaGeralLoading ? "Pauta Geral Oficial (A processar…)" : "Pauta Geral Oficial"}
                desc={pautaGeralLoading ? "A gerar PDF oficial. Aguarde." : "PDF oficial fechado e assinado."}
                onClick={periodoId && periodoClosed ? handleDownloadPautaGeralOficial : undefined}
                locked={!periodoId || !periodoClosed || pautaGeralLoading}
              />
              <DocCard
                icon={FileText}
                title="Pauta Anual (Rascunho)"
                desc="Visão final com MT1, MT2, MT3 e MFD."
                onClick={() => triggerDownload(`/api/secretaria/turmas/${turmaId}/pauta-anual`)}
              />
              <DocCard
                icon={FileText}
                title="Modelo Pauta Anual"
                desc="Modelo vazio para apresentação."
                onClick={() => triggerDownload(`/api/secretaria/turmas/${turmaId}/pauta-anual/modelo`)}
              />
              <DocCard
                icon={Download}
                title={pautaAnualLoading ? "Pauta Anual Oficial (A processar…)" : "Pauta Anual Oficial"}
                desc={pautaAnualLoading ? "A gerar PDF anual. Aguarde." : "Documento final com situação do aluno."}
                onClick={periodoId ? handleDownloadPautaAnualOficial : undefined}
                locked={!periodoId || pautaAnualLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmOpen}
        message="Fechar o período selecionado? Esta ação não poderá ser desfeita."
        loading={closing}
        onConfirm={handleClosePeriodoConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {actionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full animate-in zoom-in-95 duration-150 overflow-hidden ${
              actionModal.type === "notas" ? "max-w-6xl" : "max-w-lg"
            }`}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {actionModal.type === "notas" ? "Gerenciar notas" : "Atribuir professor"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {actionModal.disciplina.nome}
                </p>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>

            {actionModal.type === "notas" ? (
              <div className="max-h-[85vh] overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
                  <select
                    value={notasPeriodoNumero}
                    onChange={(e) => setNotasPeriodoNumero(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20 cursor-pointer"
                  >
                    {periodos.map((p) => (
                      <option key={p.id} value={p.numero}>
                        {p.tipo} {p.numero}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveNotas(notasPauta)}
                    disabled={notasSaving || notasPauta.length === 0}
                    className="px-4 py-2 rounded-xl bg-[#E3B23C] text-white text-sm font-bold hover:brightness-95 disabled:opacity-50"
                  >
                    {notasSaving ? "Salvando..." : "Salvar agora"}
                  </button>
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>
                <div className="max-h-[calc(85vh-120px)] overflow-auto px-6 py-4">
                  {notasError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {notasError}
                    </div>
                  )}
                  {notasLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Carregando pauta…
                    </div>
                  ) : (
                    <GradeEntryGrid
                      initialData={notasInitial}
                      title=""
                      subtitle={notasSaving ? "Salvando..." : "Atualize as notas do trimestre"}
                      onSave={handleSaveNotas}
                      onDataChange={(next) => setNotasPauta(next)}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Abra a gestão de professores para atribuir um docente a esta disciplina.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                  <Link
                    href={`/escola/${escolaId}/professores?tab=atribuir`}
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600"
                  >
                    Atribuir agora
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
