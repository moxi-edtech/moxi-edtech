"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef, type CSSProperties,
} from "react";
import Link from "next/link";
import {
  Search, X, UsersRound, CalendarCheck, Eye, Pencil, Plus,
  AlertTriangle, CheckCircle2, GraduationCap, UserCheck, UserX,
  BookOpen, BookX, ChevronDown, LayoutGrid, List,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { recordAuditClient } from "@/lib/auditClient";
import TurmaForm from "./TurmaForm";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";
import type { TurmaItem } from "~/types/turmas";

// ─── Design tokens (single source of truth) ───────────────────────────────────
// GREEN  = healthy / ok / confirm
// GOLD   = primary action / warning (used ONLY for these two purposes)
// ROSE   = critical / danger
// SLATE  = neutral UI chrome

const C = {
  green:      "#1F6B3B",
  greenBg:    "#1F6B3B18",
  greenBorder:"#1F6B3B30",
  gold:       "#E3B23C",       // primary action only
  goldBg:     "#E3B23C18",
  rose:       "#e11d48",
  roseBg:     "rgba(225,29,72,0.08)",
  amber:      "#b45309",
  amberBg:    "#fef3c7",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TurmasResponse {
  ok:    boolean;
  items: TurmaItem[];
  stats: {
    totalTurmas: number;
    totalAlunos: number;
    porTurno:    Array<{ turno: string; total: number }>;
  };
  next_cursor?: string | null;
}

type FinanceiroTurmaStat = {
  turmaId:          string;
  qtdMensalidades:  number;
  qtdEmAtraso:      number;
  inadimplenciaPct: number;
};

// Health is a derived signal that aggregates multiple dimensions into one
type HealthSignal = "ok" | "warning" | "critical";

type ActiveFilters = {
  turno:      string;
  status:     string;
  curso:      string;
  professor:  "todos" | "com" | "sem";
  vagas:      "todos" | "com" | "sem";
  curriculo:  "todos" | "ok" | "pendente";
  financeiro: "todos" | "inadimplentes";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã", tarde: "Tarde", noite: "Noite",
  integral: "Integral", sem_turno: "N/D",
};

const DEFAULT_FILTERS: ActiveFilters = {
  turno:      "todos",
  status:     "todos",
  curso:      "todos",
  professor:  "todos",
  vagas:      "todos",
  curriculo:  "todos",
  financeiro: "todos",
};

// ─── Health signal logic ──────────────────────────────────────────────────────
// Central place that decides how "healthy" a turma is.
// Rules: any critical condition → critical; any warning → warning; else → ok.

function computeHealth(
  turma: TurmaItem,
  financeiro?: FinanceiroTurmaStat | null,
): HealthSignal {
  const pct            = Math.min(Math.round(((turma.ocupacao_atual || 0) / (turma.capacidade_maxima || 30)) * 100), 100);
  const inadimplencia  = Number(financeiro?.inadimplenciaPct ?? 0);
  const semProfessor   = !turma.professor_nome;
  const curriculoPend  = turma.status_curriculo === "pendente";
  const isDraft        = turma.status_validacao === "rascunho";

  if (isDraft || inadimplencia >= 40 || pct >= 95) return "critical";
  if (semProfessor || curriculoPend || inadimplencia >= 20 || pct >= 75) return "warning";
  return "ok";
}

const HEALTH_CONFIG: Record<HealthSignal, { label: string; dot: string; ring: string; text: string }> = {
  ok:       { label: "Saudável",  dot: `bg-[${C.green}]`,  ring: `ring-[${C.green}]/20`,  text: `text-[${C.green}]`  },
  warning:  { label: "Atenção",   dot: "bg-amber-500",      ring: "ring-amber-200",         text: "text-amber-600"     },
  critical: { label: "Crítico",   dot: `bg-[${C.rose}]`,   ring: `ring-[${C.rose}]/20`,   text: `text-[${C.rose}]`  },
};

// ─── Lightweight helpers ──────────────────────────────────────────────────────

type ToastState = { message: string; type: "success" | "error" } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`
      fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
      text-sm font-semibold animate-in slide-in-from-bottom-2 duration-200
      ${toast.type === "success" ? "bg-[#1F6B3B] text-white" : "bg-rose-600 text-white"}
    `}>
      {toast.message}
      <button onClick={onDismiss}><X size={14} /></button>
    </div>
  );
}

function ConfirmDialog({ open, message, loading, onConfirm, onCancel }: {
  open: boolean; message: string; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <p className="text-sm font-medium text-slate-700">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors">
            {loading ? "Aprovando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
// All operationally useful filters in one bar. Admin sees all; secretary sees subset.

function FilterBar({
  filters, onChange, adminMode, cursos, search, onSearch,
}: {
  filters:   ActiveFilters;
  onChange:  (next: Partial<ActiveFilters>) => void;
  adminMode: boolean;
  cursos:    Array<{ id: string; nome: string }>
  search:    string;
  onSearch:  (value: string) => void;
}) {
  const activeCount = Object.entries(filters).filter(
    ([k, v]) => v !== "todos" && v !== DEFAULT_FILTERS[k as keyof ActiveFilters]
  ).length + (search.trim() ? 1 : 0);

  const select = (key: keyof ActiveFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ [key]: e.target.value });

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100 bg-slate-50/50">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar turma…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E3B23C]/30 focus:border-[#E3B23C] placeholder:text-slate-400"
        />
      </div>

      {/* Turno */}
      <select value={filters.turno} onChange={select("turno")}
        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
        <option value="todos">Todos os turnos</option>
        {Object.entries(TURNO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {/* Nível / Curso */}
      {cursos.length > 0 && (
        <select value={filters.curso} onChange={select("curso")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
          <option value="todos">Todos os cursos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}

      {/* Vagas */}
      <select value={filters.vagas} onChange={select("vagas")}
        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
        <option value="todos">Vagas: todas</option>
        <option value="com">Com vagas</option>
        <option value="sem">Sem vagas</option>
      </select>

      {/* Professor */}
      <select value={filters.professor} onChange={select("professor")}
        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
        <option value="todos">Professor: todos</option>
        <option value="com">Com professor</option>
        <option value="sem">Sem professor</option>
      </select>

      {/* Currículo (admin) */}
      {adminMode && (
        <select value={filters.curriculo} onChange={select("curriculo")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
          <option value="todos">Currículo: todos</option>
          <option value="ok">Currículo OK</option>
          <option value="pendente">Currículo pendente</option>
        </select>
      )}

      {/* Financeiro (admin) */}
      {adminMode && (
        <select value={filters.financeiro} onChange={select("financeiro")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
          <option value="todos">Financeiro: todos</option>
          <option value="inadimplentes">Com atraso</option>
        </select>
      )}

      {/* Status (admin) */}
      {adminMode && (
        <select value={filters.status} onChange={select("status")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
          <option value="todos">Status: todos</option>
          <option value="rascunho">Pendentes</option>
          <option value="ativos">Ativos</option>
        </select>
      )}

      {/* Clear */}
      {activeCount > 0 && (
        <button
          onClick={() => { onChange(DEFAULT_FILTERS); onSearch(""); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
        >
          <X size={14} /> Limpar ({activeCount})
        </button>
      )}
    </div>
  );
}

// ─── Health badge (replaces scattered color logic) ────────────────────────────

function HealthBadge({ signal }: { signal: HealthSignal }) {
  const cfg = HEALTH_CONFIG[signal];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Health detail breakdown (shown in health column) ────────────────────────

function HealthDetail({ turma, financeiro }: { turma: TurmaItem; financeiro?: FinanceiroTurmaStat | null }) {
  const pct           = Math.min(Math.round(((turma.ocupacao_atual || 0) / (turma.capacidade_maxima || 30)) * 100), 100);
  const inadimplencia = Number(financeiro?.inadimplenciaPct ?? 0);
  const temProfessor  = Boolean(turma.professor_nome);
  const curriculoOk   = turma.status_curriculo !== "pendente";
  const signal        = computeHealth(turma, financeiro);

  return (
    <div className="space-y-1.5">
      <HealthBadge signal={signal} />
      <div className="flex flex-col gap-1 mt-1">
        {/* Ocupação */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-[#1F6B3B]"}`} />
          Ocupação {pct}%
        </div>
        {/* Professor */}
        <div className={`flex items-center gap-1.5 text-[10px] ${temProfessor ? "text-slate-500" : "text-amber-600 font-semibold"}`}>
          {temProfessor
            ? <UserCheck size={10} className="text-[#1F6B3B]" />
            : <UserX size={10} className="text-amber-500" />}
          {temProfessor ? turma.professor_nome : "Sem professor"}
        </div>
        {/* Currículo */}
        <div className={`flex items-center gap-1.5 text-[10px] ${curriculoOk ? "text-slate-500" : "text-amber-600 font-semibold"}`}>
          {curriculoOk
            ? <BookOpen size={10} className="text-[#1F6B3B]" />
            : <BookX size={10} className="text-amber-500" />}
          {curriculoOk ? "Currículo OK" : "Currículo pendente"}
        </div>
        {/* Inadimplência (only if notable) */}
        {financeiro && inadimplencia > 0 && (
          <div className={`flex items-center gap-1.5 text-[10px] ${inadimplencia >= 20 ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${inadimplencia >= 40 ? "bg-rose-500" : "bg-amber-400"}`} />
            Inadimplência {inadimplencia.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Secretary card view ──────────────────────────────────────────────────────
// Cards grouped by turno — less dense, more scannable for secretaries.

function SecretaryCardView({
  items, detailHrefBase, onEdit,
}: {
  items:          TurmaItem[];
  detailHrefBase: string;
  onEdit:         (t: TurmaItem) => void;
}) {
  const byTurno = useMemo(() => {
    const groups: Record<string, TurmaItem[]> = {};
    items.forEach((t) => {
      const key = t.turno || "sem_turno";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
        <Search size={24} />
        <p className="text-sm font-medium text-slate-600">Nenhuma turma encontrada</p>
        <p className="text-xs">Ajuste os filtros acima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-5">
      {Object.entries(byTurno).map(([turno, turmas]) => (
        <div key={turno}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {TURNO_LABELS[turno] ?? turno}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{turmas.length} turma(s)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {turmas.map((turma) => {
              const max    = turma.capacidade_maxima || 30;
              const atual  = turma.ocupacao_atual    || 0;
              const pct    = Math.min(Math.round((atual / max) * 100), 100);
              const signal = computeHealth(turma, null);
              const isDraft = turma.status_validacao === "rascunho";

              return (
                <div key={turma.id} className={`
                  group rounded-xl border bg-white p-4 transition-all hover:shadow-md
                  ${isDraft ? "border-amber-200 bg-amber-50/30" : "border-slate-200 hover:border-slate-300"}
                `}>
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{turma.nome || "Sem nome"}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {turma.curso_nome || "Ensino Geral"} · {turma.classe_nome || "—"}
                      </p>
                    </div>
                    <HealthBadge signal={signal} />
                  </div>

                  {/* Occupancy bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-slate-500">{atual}/{max} alunos</span>
                      <span className={pct >= 95 ? "text-rose-600" : pct >= 75 ? "text-amber-600" : "text-[#1F6B3B]"}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-amber-400" : "bg-[#1F6B3B]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {turma.professor_nome
                        ? <><UserCheck size={12} className="text-[#1F6B3B]" /><span className="truncate max-w-[100px]">{turma.professor_nome}</span></>
                        : <><UserX size={12} className="text-amber-500" /><span className="text-amber-600 font-semibold">Sem prof.</span></>
                      }
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isDraft && (
                        <Link href={`${detailHrefBase}/${turma.id}`}
                          className="p-1.5 text-slate-400 hover:text-[#1F6B3B] hover:bg-green-50 rounded-lg transition-colors">
                          <Eye size={14} />
                        </Link>
                      )}
                      <button onClick={() => onEdit(turma)}
                        className="p-1.5 text-slate-400 hover:text-[#E3B23C] hover:bg-amber-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Admin table row ──────────────────────────────────────────────────────────

function TurmaRow({
  turma, isExpanded, onToggleExpand, onEdit, style,
  detailHrefBase, financeiro,
}: {
  turma:          TurmaItem;
  isExpanded:     boolean;
  onToggleExpand: () => void;
  onEdit:         (t: TurmaItem) => void;
  style?:         CSSProperties;
  detailHrefBase: string;
  financeiro?:    FinanceiroTurmaStat | null;
}) {
  const safeNome  = turma.nome || "Sem Nome";
  const iniciais  = safeNome.substring(0, 2).toUpperCase();
  const isDraft   = turma.status_validacao === "rascunho";
  const signal    = computeHealth(turma, financeiro);

  return (
    <tr
      className={`border-b border-slate-100 transition-colors group ${
        isDraft ? "bg-amber-50/30" : isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
      }`}
      style={style}
    >
      {/* Nome */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border flex-shrink-0
            ${isDraft ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {iniciais}
          </div>
          <div className="min-w-0">
            {isDraft ? (
              <span className="font-bold text-sm text-slate-800">{safeNome}</span>
            ) : (
              <Link href={`${detailHrefBase}/${turma.id}`}
                className="font-bold text-sm text-slate-900 hover:text-[#1F6B3B] hover:underline decoration-[#1F6B3B]/30 underline-offset-4 transition-colors">
                {safeNome}
              </Link>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded">
                {turma.ano_letivo || "—"}
              </span>
              {isDraft && <span className="text-[10px] font-bold text-amber-600">RASCUNHO</span>}
            </div>
          </div>
        </div>
      </td>

      {/* Curso + Turno */}
      <td className="px-5 py-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 truncate">{turma.curso_nome || "Ensino Geral"}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">{turma.classe_nome || "—"}</span>
            <span className="text-slate-200">·</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
              {TURNO_LABELS[turma.turno || ""] || turma.turno || "—"}
            </span>
          </div>
        </div>
      </td>

      {/* Sala */}
      <td className="px-5 py-4">
        <span className="text-sm text-slate-600">{turma.sala || "—"}</span>
      </td>

      {/* Health (consolidated) */}
      <td className="px-5 py-4">
        <HealthDetail turma={turma} financeiro={financeiro} />
      </td>

      {/* Ações */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          {isDraft ? (
            <button onClick={() => onEdit(turma)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E3B23C] text-white hover:brightness-95 rounded-xl text-xs font-bold shadow-sm transition-all">
              <CheckCircle2 size={13} /> Ativar
            </button>
          ) : (
            <>
              <Link href={`${detailHrefBase}/${turma.id}`}
                className="p-2 text-slate-400 hover:text-[#1F6B3B] hover:bg-green-50 rounded-lg transition-colors">
                <Eye size={15} />
              </Link>
              <button onClick={() => onEdit(turma)}
                className="p-2 text-slate-400 hover:text-[#E3B23C] hover:bg-amber-50 rounded-lg transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={onToggleExpand}
                className={`p-2 rounded-lg transition-colors ${isExpanded ? "text-slate-800 bg-slate-100" : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"}`}>
                <UsersRound size={15} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TurmasListClient({ adminMode = false }: { adminMode?: boolean }) {
  const { escolaId, isLoading: escolaLoading } = useEscolaId();

  const [data,            setData]            = useState<TurmasResponse | null>(null);
  const [items,           setItems]           = useState<TurmaItem[]>([]);
  const [nextCursor,      setNextCursor]      = useState<string | null>(null);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [busca,           setBusca]           = useState("");
  const [filters,         setFilters]         = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [financeiroStats, setFinanceiroStats] = useState<Record<string, FinanceiroTurmaStat>>({});
  const [showForm,        setShowForm]        = useState(false);
  const [editingTurma,    setEditingTurma]    = useState<TurmaItem | null>(null);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [toast,           setToast]           = useState<ToastState>(null);
  const [confirmOpen,     setConfirmOpen]     = useState(false);
  const [confirmLoading,  setConfirmLoading]  = useState(false);
  // Secretary defaults to card view; admin defaults to table
  const [viewMode,        setViewMode]        = useState<"table" | "cards">(adminMode ? "table" : "cards");

  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const auditSentRef    = useRef(false);

  // ── Audit ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (auditSentRef.current || escolaLoading || !escolaId) return;
    auditSentRef.current = true;
    recordAuditClient({
      escolaId, portal: adminMode ? "admin_escola" : "secretaria",
      acao: "PAGE_VIEW", entity: "turmas_list", details: {},
    });
  }, [adminMode, escolaId, escolaLoading]);

  // ── Fetch turmas ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (options?: { cursor?: string | null; append?: boolean }) => {
    if (!escolaId) { setLoading(false); return; }
    try {
      options?.append ? setLoadingMore(true) : setLoading(true);
      const params = new URLSearchParams();
      if (filters.turno   !== "todos") params.set("turno",  filters.turno);
      if (filters.status  !== "todos") params.set("status", filters.status);
      if (filters.curso   !== "todos") params.set("curso_id",  filters.curso);
      if (busca.trim())                params.set("busca",  busca.trim());
      params.set("limit", "30");
      if (options?.cursor) params.set("cursor", options.cursor);

      const res  = await fetch(buildEscolaUrl(escolaId, "/turmas", params), {
        headers: { "X-Proxy-Used": "canonical" },
      });
      const json = await res.json();
      if (json.ok) {
        setData(json);
        setNextCursor(json.next_cursor ?? null);
        setItems((prev) => options?.append ? [...prev, ...(json.items || [])] : (json.items || []));
      }
    } catch (err) {
      console.error("Erro ao buscar turmas", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [escolaId, filters, busca]);

  useEffect(() => {
    if (escolaLoading || !escolaId) { if (!escolaLoading) setLoading(false); return; }
    const t = setTimeout(() => { setNextCursor(null); fetchData({ append: false }); }, 300);
    return () => clearTimeout(t);
  }, [fetchData, escolaId, escolaLoading]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    await fetchData({ cursor: nextCursor, append: true });
  }, [fetchData, nextCursor, loadingMore]);

  // ── Financeiro fetch — stable on itemIds ──────────────────────────────────
  const itemIds = useMemo(() => items.map((i) => i.id).join(","), [items]);
  useEffect(() => {
    if (!adminMode || !escolaId || !itemIds) { setFinanceiroStats({}); return; }
    const params = new URLSearchParams({ turma_ids: itemIds });
    fetch(buildEscolaUrl(escolaId, "/admin/turmas/financeiro", params))
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        const map: Record<string, FinanceiroTurmaStat> = {};
        (json.items || []).forEach((row: FinanceiroTurmaStat) => {
          if (row?.turmaId) map[row.turmaId] = row;
        });
        setFinanceiroStats(map);
      })
      .catch(() => null);
  }, [adminMode, escolaId, itemIds]);

  // ── Client-side filtering (for fields not sent to API) ────────────────────
  const filteredItems = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return items.filter((t) => {
      if (filters.curso !== "todos" && t.curso_id !== filters.curso) return false;
      if (query) {
        const haystack = [t.nome, t.turma_codigo, t.curso_nome, t.classe_nome]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.professor === "com" && !t.professor_nome) return false;
      if (filters.professor === "sem" && t.professor_nome)  return false;

      const max  = t.capacidade_maxima || 30;
      const livre = max - (t.ocupacao_atual || 0);
      if (filters.vagas === "com" && livre <= 0) return false;
      if (filters.vagas === "sem" && livre > 0)  return false;

      if (filters.curriculo === "ok"      && t.status_curriculo === "pendente") return false;
      if (filters.curriculo === "pendente" && t.status_curriculo !== "pendente") return false;

      if (filters.financeiro === "inadimplentes" &&
          (financeiroStats[t.id]?.qtdEmAtraso ?? 0) === 0) return false;

      return true;
    });
  }, [items, filters, financeiroStats, busca]);

  const rascunhos    = useMemo(() => items.filter((t) => t.status_validacao === "rascunho").length, [items]);
  const pendingItems = useMemo(() =>
    adminMode && filters.status === "rascunho"
      ? filteredItems.filter((t) => t.status_validacao === "rascunho")
      : [],
    [adminMode, filters.status, filteredItems]
  );

  // ── Cursos for filter dropdown ────────────────────────────────────────────
  const cursos = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((t) => {
      if (t.curso_id && t.curso_nome && !map.has(t.curso_id)) {
        map.set(t.curso_id, t.curso_nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [items]);

  // ── Virtual rows (admin table only) ──────────────────────────────────────
  const displayRows = useMemo(() => {
    const rows: Array<{ key: string; type: "turma" | "expanded"; turma: TurmaItem }> = [];
    filteredItems.forEach((turma) => {
      rows.push({ key: turma.id, type: "turma", turma });
      if (expandedId === turma.id) rows.push({ key: `${turma.id}-expanded`, type: "expanded", turma });
    });
    return rows;
  }, [filteredItems, expandedId]);

  const hasRows = !loading && displayRows.length > 0;

  const rowVirtualizer = useVirtualizer({
    count:            displayRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize:     (i) => (displayRows[i]?.type === "expanded" ? 140 : 96),
    overscan:         6,
  });

  // ── Approve pending ───────────────────────────────────────────────────────
  const handleApproveConfirmed = useCallback(async () => {
    if (!escolaId) return;
    setConfirmLoading(true);
    try {
      const res  = await fetch(buildEscolaUrl(escolaId, "/admin/turmas/aprovar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_ids: pendingItems.map((t) => t.id) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao aprovar turmas");
      setConfirmOpen(false);
      setToast({ message: `${pendingItems.length} turma(s) aprovada(s)`, type: "success" });
      await fetchData();
    } catch (err: any) {
      setToast({ message: err?.message || "Falha ao aprovar turmas", type: "error" });
    } finally {
      setConfirmLoading(false);
    }
  }, [escolaId, pendingItems, fetchData]);

  const detailHrefBase = adminMode && escolaId
    ? `/escola/${escolaId}/admin/turmas`
    : `/secretaria/turmas`;

  const handleFilterChange = useCallback((next: Partial<ActiveFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 pb-24">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Turmas</h1>
          <p className="text-sm text-slate-500 mt-1">Estrutura académica e alocação de salas.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}>
              <List size={15} />
            </button>
            <button onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}>
              <LayoutGrid size={15} />
            </button>
          </div>

          <button
            onClick={() => { setEditingTurma(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E3B23C] text-white rounded-xl text-sm font-bold hover:brightness-95 shadow-sm transition-all active:scale-95"
          >
            <Plus size={17} /> Nova Turma
          </button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: data?.stats.totalTurmas  ?? 0, icon: UsersRound,    dark: true },
          { label: "Alunos",    value: data?.stats.totalAlunos  ?? 0, icon: GraduationCap, dark: false },
          { label: "Pendentes", value: rascunhos,                      icon: AlertTriangle, dark: false },
          { label: "Turnos",    value: data?.stats.porTurno.length ?? 0, icon: CalendarCheck, dark: false },
        ].map(({ label, value, icon: Icon, dark }) => (
          <div key={label} className={`p-4 rounded-xl border transition-all ${dark ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200"}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? "text-slate-400" : "text-slate-400"}`}>{label}</p>
                <p className={`text-2xl font-bold mt-1 ${dark ? "text-white" : "text-slate-900"}`}>{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${dark ? "bg-white/10 text-[#E3B23C]" : "bg-slate-50 text-slate-400"}`}>
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pending banner ──────────────────────────────────────────────────── */}
      {adminMode && filters.status === "rascunho" && pendingItems.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span>{pendingItems.length} turma(s) pendente(s) de aprovação.</span>
          <button onClick={() => setConfirmOpen(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors">
            Aprovar pendentes
          </button>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          adminMode={adminMode}
          cursos={cursos}
          search={busca}
          onSearch={setBusca}
        />

        {viewMode === "cards" ? (
          <SecretaryCardView
            items={filteredItems}
            detailHrefBase={detailHrefBase}
            onEdit={(t) => { setEditingTurma(t); setShowForm(true); }}
          />
        ) : (
          <div className="overflow-x-auto">
            <div ref={scrollParentRef} className="max-h-[600px] overflow-y-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0 z-10"
                  style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[28%]">Turma</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[22%]">Curso / Nível</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[12%]">Sala</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[26%]">Saúde</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[12%]">Ações</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y divide-slate-50 bg-white"
                  style={hasRows ? { position: "relative", display: "block", height: rowVirtualizer.getTotalSize() } : undefined}
                >
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse"
                        style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                        <td className="px-5 py-4"><div className="h-9 w-9 bg-slate-100 rounded-xl" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-full bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4" />
                      </tr>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Search size={22} />
                          <p className="font-medium text-slate-600">Nenhuma turma encontrada</p>
                          <p className="text-xs">Ajuste os filtros acima.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = displayRows[virtualRow.index];
                      if (!row) return null;
                      const vs: CSSProperties = {
                        position: "absolute", top: 0, left: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        width: "100%", display: "table", tableLayout: "fixed",
                      };
                      if (row.type === "expanded") {
                        return (
                          <tr key={row.key} className="bg-slate-50/50" style={vs}>
                            <td colSpan={5} className="px-5 py-4">
                              <div className="ml-11 p-4 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">
                                Lista rápida de professores e detalhes avançados.
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <TurmaRow
                          key={row.key}
                          turma={row.turma}
                          isExpanded={expandedId === row.turma.id}
                          onToggleExpand={() => setExpandedId((p) => p === row.turma.id ? null : row.turma.id)}
                          onEdit={(t) => { setEditingTurma(t); setShowForm(true); }}
                          detailHrefBase={detailHrefBase}
                          financeiro={financeiroStats[row.turma.id]}
                          style={vs}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {nextCursor && (
              <div className="flex justify-center py-4">
                <button onClick={loadMore} disabled={loadingMore}
                  className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors">
                  {loadingMore ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Form modal ──────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingTurma ? "Editar Turma" : "Nova Turma"}
              </h3>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {escolaId ? (
                <TurmaForm escolaId={escolaId} initialData={editingTurma}
                  onSuccess={() => { setShowForm(false); fetchData(); }} />
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  Escola não identificada. Recarregue a página.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message={`Aprovar ${pendingItems.length} turma(s) pendente(s)? Esta ação não pode ser desfeita.`}
        loading={confirmLoading}
        onConfirm={handleApproveConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
