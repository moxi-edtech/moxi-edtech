"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef, type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, X, UsersRound, CalendarCheck, Eye, Pencil, Plus,
  AlertTriangle, CheckCircle2, GraduationCap, UserCheck, UserX,
  BookOpen, BookX, ChevronDown, LayoutGrid, List, MapPin,
  Printer, Lock, Send,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { recordAuditClient } from "@/lib/auditClient";
import TurmaForm from "./TurmaForm";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { buildEscolaUrl } from "@/lib/escola/url";
import { formatTurmaNomeHumano } from "@/utils/formatters";
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

type PedagogicoTurmaStat = {
  turma_id:               string;
  media_presenca:         number;
  media_notas:            number;
  alunos_abaixo_presenca: number;
  alunos_abaixo_notas:    number;
  is_desescoberta:        boolean;
  decomposicao_saude:     any;
  candidatos_espera:      number;
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
  espera:     "todos" | "com";
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
  espera:     "todos",
};

// ─── Health signal logic ──────────────────────────────────────────────────────
// Central place that decides how "healthy" a turma is.
// Rules: any critical condition → critical; any warning → warning; else → ok.

function computeHealth(
  turma: TurmaItem,
  financeiro?: FinanceiroTurmaStat | null,
  pedagogico?: PedagogicoTurmaStat | null,
): HealthSignal {
  const pct            = Math.min(Math.round(((turma.ocupacao_atual || 0) / (turma.capacidade_maxima || 30)) * 100), 100);
  const inadimplencia  = Number(financeiro?.inadimplenciaPct ?? 0);
  const semProfessor   = !turma.professor_nome;
  const curriculoPend  = turma.status_curriculo === "pendente";
  const isDraft        = turma.status_validacao === "rascunho";

  // Pedagogical health (Fase 2)
  const lowAttendance  = (pedagogico?.media_presenca ?? 100) < 75;
  const lowGrades      = (pedagogico?.media_notas ?? 100) < 50;
  const desescoberta   = pedagogico?.is_desescoberta ?? false;

  if (isDraft || inadimplencia >= 40 || pct >= 95) return "critical";
  if (semProfessor || curriculoPend || inadimplencia >= 20 || pct >= 75 || lowAttendance || lowGrades || desescoberta) return "warning";
  return "ok";
}

const HEALTH_CONFIG: Record<HealthSignal, { label: string; dot: string; ring: string; text: string }> = {
  ok:       { label: "Saudável",  dot: `bg-[${C.green}]`,  ring: `ring-[${C.green}]/20`,  text: `text-[${C.green}]`  },
  warning:  { label: "Atenção",   dot: "bg-klasse-gold-500",      ring: "ring-klasse-gold-200",         text: "text-klasse-gold-600"     },
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
            className="px-4 py-2 rounded-xl bg-klasse-gold-500 text-white text-sm font-bold hover:bg-klasse-gold-600 disabled:opacity-60 transition-colors">
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

      {/* Candidatos em Espera */}
      <select value={filters.espera} onChange={select("espera")}
        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
        <option value="todos">Candidatos: todos</option>
        <option value="com">Com espera</option>
      </select>

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

function HealthDetail({ 
  turma, financeiro, pedagogico, secretariaBase 
}: { 
  turma: TurmaItem; 
  financeiro?: FinanceiroTurmaStat | null;
  pedagogico?: PedagogicoTurmaStat | null;
  secretariaBase: string;
}) {
  const pct           = Math.min(Math.round(((turma.ocupacao_atual || 0) / (turma.capacidade_maxima || 30)) * 100), 100);
  const inadimplencia = Number(financeiro?.inadimplenciaPct ?? 0);
  const temProfessor  = Boolean(turma.professor_nome);
  const curriculoOk   = turma.status_curriculo !== "pendente";
  const signal        = computeHealth(turma, financeiro, pedagogico);

  return (
    <div className="space-y-1.5">
      <HealthBadge signal={signal} />
      <div className="flex flex-col gap-1 mt-1">
        {/* Ocupação */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-klasse-gold-500" : "bg-[#1F6B3B]"}`} />
          Ocupação {pct}%
        </div>
        
        {/* Pedagogical Stats (Fase 2) */}
        {pedagogico && (
          <>
            <div className={`flex items-center gap-1.5 text-[10px] ${pedagogico.media_presenca < 75 ? "text-rose-600 font-semibold" : "text-slate-500"}`}
                 title={`${pedagogico.alunos_abaixo_presenca} alunos abaixo do mínimo`}>
              <span className={`w-1 h-1 rounded-full flex-shrink-0 ${pedagogico.media_presenca < 75 ? "bg-rose-500" : "bg-[#1F6B3B]"}`} />
              Assiduidade {Math.round(pedagogico.media_presenca)}%
            </div>
            <div className={`flex items-center gap-1.5 text-[10px] ${pedagogico.media_notas < 50 ? "text-rose-600 font-semibold" : "text-slate-500"}`}
                 title={`${pedagogico.alunos_abaixo_notas} disciplinas críticas`}>
              <span className={`w-1 h-1 rounded-full flex-shrink-0 ${pedagogico.media_notas < 50 ? "bg-rose-500" : "bg-[#1F6B3B]"}`} />
              Média {Math.round(pedagogico.media_notas)}%
            </div>
            {pedagogico.is_desescoberta && (
              <div className="flex items-center gap-1.5 text-[10px] text-rose-600 font-bold animate-pulse" title="Horário prevê aula mas não há professor atribuído">
                <AlertTriangle size={10} /> Turma Desescoberta
              </div>
            )}
          </>
        )}

        {/* Professor */}
        <div className={`flex items-center gap-1.5 text-[10px] ${temProfessor ? "text-slate-500" : "text-klasse-gold-600 font-semibold"}`}>
          {temProfessor
            ? <UserCheck size={10} className="text-[#1F6B3B]" />
            : <UserX size={10} className="text-klasse-gold-500" />}
          {temProfessor ? turma.professor_nome : "Sem professor"}
        </div>
        
        {/* Currículo */}
        <div className={`flex items-center gap-1.5 text-[10px] ${curriculoOk ? "text-slate-500" : "text-klasse-gold-600 font-semibold"}`}>
          {curriculoOk
            ? <BookOpen size={10} className="text-[#1F6B3B]" />
            : <BookX size={10} className="text-klasse-gold-500" />}
          {curriculoOk ? "Currículo OK" : "Currículo pendente"}
        </div>
        
        {/* Inadimplência (only if notable) */}
        {financeiro && inadimplencia > 0 && (
          <div className={`flex items-center gap-1.5 text-[10px] ${inadimplencia >= 20 ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${inadimplencia >= 40 ? "bg-rose-500" : "bg-klasse-gold-400"}`} />
            Inadimplência {inadimplencia.toFixed(0)}%
          </div>
        )}

        {/* Candidatos em Espera (Fase 4) */}
        {pedagogico && pedagogico.candidatos_espera > 0 && (
          <Link 
            href={`${secretariaBase}/admissoes?turmaId=${turma.id}&search=${encodeURIComponent(turma.nome || "")}`}
            className="flex items-center gap-1.5 text-[10px] text-klasse-gold-600 font-bold hover:underline"
          >
            <UsersRound size={10} />
            {pedagogico.candidatos_espera} candidato(s) em espera
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Secretary card view ──────────────────────────────────────────────────────
// Cards grouped by turno — less dense, more scannable for secretaries.

function SecretaryCardView({
  items, detailHrefBase, secretariaBase, onEdit, pedagogicoStats,
  selectedIds, onToggleSelect,
}: {
  items:           TurmaItem[];
  detailHrefBase:  string;
  secretariaBase:  string;
  onEdit:          (t: TurmaItem) => void;
  pedagogicoStats: Record<string, PedagogicoTurmaStat>;
  selectedIds:     Set<string>;
  onToggleSelect:  (id: string) => void;
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
              const ped    = pedagogicoStats[turma.id];
              const signal = computeHealth(turma, null, ped);
              const isDraft = turma.status_validacao === "rascunho";
              const isSelected = selectedIds.has(turma.id);
              const displayNome = formatTurmaNomeHumano(turma.nome ?? turma.turma_codigo, turma.curso_nome);

              return (
                <div key={turma.id} className={`
                  group relative rounded-xl border bg-white p-4 transition-all hover:shadow-md
                  ${isSelected ? "ring-2 ring-klasse-gold-400 border-klasse-gold-200" : isDraft ? "border-klasse-gold-200 bg-klasse-gold-50/30" : "border-slate-200 hover:border-slate-300"}
                `}>
                  {/* Checkbox overlay */}
                  <div className={`absolute top-3 left-3 z-10 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(turma.id)}
                      className="w-4 h-4 rounded border-slate-300 text-klasse-gold-500 focus:ring-klasse-gold-500 cursor-pointer"
                    />
                  </div>

                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2 mb-3 ml-6">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{displayNome}</p>
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
                      <span className={pct >= 95 ? "text-rose-600" : pct >= 75 ? "text-klasse-gold-600" : "text-[#1F6B3B]"}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-klasse-gold-400" : "bg-[#1F6B3B]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {turma.professor_nome
                        ? <><UserCheck size={12} className="text-[#1F6B3B]" /><span className="truncate max-w-[100px]">{turma.professor_nome}</span></>
                        : <><UserX size={12} className="text-klasse-gold-500" /><span className="text-klasse-gold-600 font-semibold">Sem prof.</span></>
                      }
                      {ped?.is_desescoberta && <AlertTriangle size={12} className="text-rose-500 animate-pulse" />}
                    </div>

                    <div className="flex items-center gap-3">
                      {ped && ped.candidatos_espera > 0 && (
                        <Link 
                          href={`${secretariaBase}/admissoes?turmaId=${turma.id}&search=${encodeURIComponent(turma.nome || "")}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-klasse-gold-50 text-klasse-gold-700 rounded-lg text-[10px] font-bold border border-klasse-gold-200 hover:bg-klasse-gold-100 transition-colors"
                          title={`${ped.candidatos_espera} candidato(s) em espera`}
                        >
                          <UsersRound size={12} />
                          {ped.candidatos_espera}
                        </Link>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isDraft && (
                          <Link href={`${detailHrefBase}/${turma.id}`}
                            className="p-1.5 text-slate-400 hover:text-[#1F6B3B] hover:bg-green-50 rounded-lg transition-colors">
                            <Eye size={14} />
                          </Link>
                        )}
                        <button onClick={() => onEdit(turma)}
                          className="p-1.5 text-slate-400 hover:text-[#E3B23C] hover:bg-klasse-gold-50 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                      </div>
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
  detailHrefBase, secretariaBase, financeiro, pedagogico,
  editingCell, onStartEdit, onCancelEdit, onSaveEdit, loadingCell,
  isSelected, onToggleSelect,
}: {
  turma:          TurmaItem;
  isExpanded:     boolean;
  onToggleExpand: () => void;
  onEdit:         (t: TurmaItem) => void;
  style?:         CSSProperties;
  detailHrefBase: string;
  secretariaBase: string;
  financeiro?:    FinanceiroTurmaStat | null;
  pedagogico?:    PedagogicoTurmaStat | null;
  editingCell:    { id: string; field: "sala" | "capacidade_maxima" } | null;
  onStartEdit:    (id: string, field: "sala" | "capacidade_maxima") => void;
  onCancelEdit:   () => void;
  onSaveEdit:     (id: string, field: "sala" | "capacidade_maxima", value: any) => void;
  loadingCell:    string | null;
  isSelected:     boolean;
  onToggleSelect: (id: string) => void;
}) {
  const safeNome  = formatTurmaNomeHumano(turma.nome ?? turma.turma_codigo, turma.curso_nome);
  const iniciais  = safeNome.substring(0, 2).toUpperCase();
  const isDraft   = turma.status_validacao === "rascunho";
  const signal    = computeHealth(turma, financeiro, pedagogico);

  const isEditingSala = editingCell?.id === turma.id && editingCell?.field === "sala";
  const isEditingCap  = editingCell?.id === turma.id && editingCell?.field === "capacidade_maxima";
  const isLoadingSala = loadingCell === `${turma.id}-sala`;
  const isLoadingCap  = loadingCell === `${turma.id}-capacidade_maxima`;

  return (
    <tr
      className={`border-b border-slate-100 transition-colors group ${
        isSelected ? "bg-klasse-gold-50/50" : isDraft ? "bg-klasse-gold-50/30" : isExpanded ? "bg-slate-50" : "hover:bg-slate-50"
      }`}
      style={style}
    >
      {/* Checkbox */}
      <td className="px-5 py-4 w-[40px]">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(turma.id)}
          className="w-4 h-4 rounded border-slate-300 text-klasse-gold-500 focus:ring-klasse-gold-500 cursor-pointer"
        />
      </td>

      {/* ... Nome ... */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border flex-shrink-0
            ${isDraft ? "bg-klasse-gold-100 text-klasse-gold-700 border-klasse-gold-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
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
              {isDraft && <span className="text-[10px] font-bold text-klasse-gold-600">RASCUNHO</span>}
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
        {isEditingSala ? (
          <input
            autoFocus
            className="w-full px-2 py-1 text-sm border border-[#E3B23C] rounded-lg outline-none focus:ring-2 focus:ring-[#E3B23C]/20"
            defaultValue={turma.sala || ""}
            onBlur={(e) => onSaveEdit(turma.id, "sala", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit(turma.id, "sala", e.currentTarget.value);
              if (e.key === "Escape") onCancelEdit();
            }}
          />
        ) : (
          <div
            className={`flex items-center gap-2 cursor-pointer group/cell ${isLoadingSala ? "opacity-50" : ""}`}
            onClick={() => onStartEdit(turma.id, "sala")}
          >
            <span className="text-sm text-slate-600 truncate max-w-[80px]">
              {isLoadingSala ? "..." : turma.sala || "—"}
            </span>
            <Pencil size={10} className="text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* Capacidade */}
      <td className="px-5 py-4">
        {isEditingCap ? (
          <input
            autoFocus
            type="number"
            className="w-16 px-2 py-1 text-sm border border-[#E3B23C] rounded-lg outline-none focus:ring-2 focus:ring-[#E3B23C]/20"
            defaultValue={turma.capacidade_maxima || 30}
            onBlur={(e) => onSaveEdit(turma.id, "capacidade_maxima", Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit(turma.id, "capacidade_maxima", Number(e.currentTarget.value));
              if (e.key === "Escape") onCancelEdit();
            }}
          />
        ) : (
          <div
            className={`flex items-center gap-2 cursor-pointer group/cell ${isLoadingCap ? "opacity-50" : ""}`}
            onClick={() => onStartEdit(turma.id, "capacidade_maxima")}
          >
            <span className="text-sm text-slate-600">
              {isLoadingCap ? ".." : turma.capacidade_maxima || 30}
            </span>
            <Pencil size={10} className="text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* Health (consolidated) */}
      <td className="px-5 py-4">
        <HealthDetail turma={turma} financeiro={financeiro} pedagogico={pedagogico} secretariaBase={secretariaBase} />
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
                className="p-2 text-slate-400 hover:text-[#E3B23C] hover:bg-klasse-gold-50 rounded-lg transition-colors">
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

export default function TurmasListClient({ 
  adminMode = false,
  initialData = null
}: { 
  adminMode?: boolean;
  initialData?: TurmasResponse | null;
}) {
  const { escolaId, escolaSlug, isLoading: escolaLoading } = useEscolaId();
  const pathname = usePathname();
  const slugFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const escolaParam = slugFromPath || escolaSlug || escolaId;
  const secretariaBase = buildPortalHref(escolaParam, "/secretaria");

  const [data,            setData]            = useState<TurmasResponse | null>(initialData);
  const [items,           setItems]           = useState<TurmaItem[]>(initialData?.items || []);
  const [nextCursor,      setNextCursor]      = useState<string | null>(initialData?.next_cursor ?? null);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [loading,         setLoading]         = useState(!initialData);
  const [busca,           setBusca]           = useState("");
  const [filters,         setFilters]         = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [financeiroStats, setFinanceiroStats] = useState<Record<string, FinanceiroTurmaStat>>({});
  const [pedagogicoStats, setPedagogicoStats] = useState<Record<string, PedagogicoTurmaStat>>({});
  const [showForm,        setShowForm]        = useState(false);
  const [editingTurma,    setEditingTurma]    = useState<TurmaItem | null>(null);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [expandedData,    setExpandedData]    = useState<Record<string, any>>({});
  const [expandedLoading, setExpandedLoading] = useState<string | null>(null);
  const [substituting,    setSubstituting]    = useState<string | null>(null); // turmaId
  const [professors,      setProfessors]      = useState<any[]>([]);
  const [loadingProfs,    setLoadingProfs]    = useState(false);
  const [selectedProf,    setSelectedProf]    = useState<string>("");

  const fetchProfessors = useCallback(async () => {
    if (!escolaId || professors.length > 0) return;
    setLoadingProfs(true);
    try {
      const res = await fetch(`/api/secretaria/professores?escola_id=${escolaId}&pageSize=100&cargo=professor`);
      const json = await res.json();
      if (json.ok) setProfessors(json.items || []);
    } catch (err) {
      console.error("Erro ao buscar professores", err);
    } finally {
      setLoadingProfs(false);
    }
  }, [escolaId, professors.length]);

  const handleAssignSubstitute = async (turmaId: string, slotId: string) => {
    if (!escolaId || !selectedProf) return;
    try {
      const res = await fetch(`/api/escolas/${escolaId}/admin/turmas/${turmaId}/substituicoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId, professor_id: selectedProf }),
      });
      const json = await res.json();
      if (json.ok) {
        setToast({ message: "Substituto atribuído com sucesso!", type: "success" });
        setSubstituting(null);
        setSelectedProf("");
        fetchQuickView(turmaId);
      } else {
        throw new Error(json.error || "Erro ao atribuir");
      }
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    }
  };

  // Selection state (Fase 3)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((filteredIds: string[]) => {
    setSelectedIds(prev => {
      if (prev.size === filteredIds.length) return new Set();
      return new Set(filteredIds);
    });
  }, []);

  const handleBulkPrint = async () => {
    if (!escolaId || selectedIds.size === 0) return;
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/turmas/bulk-print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao iniciar impressão");
      setToast({ message: "Lote de impressão iniciado. Verifique o Hub de Documentos para baixar.", type: "success" });
      setSelectedIds(new Set());
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleBulkClose = async () => {
    if (!escolaId || selectedIds.size === 0) return;
    const confirm = window.confirm(`Deseja realmente FECHAR o período de ${selectedIds.size} turma(s)? Isso bloqueará o lançamento de novas notas.`);
    if (!confirm) return;

    let success = 0;
    let failed = 0;

    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/turmas/${id}/fecho`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "FECHADO", reason: "Fechamento em bloco (Secretaria)" }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setToast({
      message: `${success} turma(s) fechada(s). ${failed > 0 ? `${failed} falha(s).` : ""}`,
      type: failed > 0 ? "error" : "success"
    });
    setSelectedIds(new Set());
    fetchData();
  };

  const handleBulkNotify = () => {
    setToast({ message: `Preparando notificação para encarregados de ${selectedIds.size} turma(s)...`, type: "success" });
  };

  const fetchQuickView = useCallback(async (turmaId: string) => {
    if (!escolaId || expandedData[turmaId]) return;
    setExpandedLoading(turmaId);
    try {
      const [qvRes, histRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/admin/turmas/${turmaId}/quick-view`),
        fetch(`/api/escolas/${escolaId}/admin/turmas/${turmaId}/historico-ocupacao`)
      ]);
      const qvJson = await qvRes.json();
      const histJson = await histRes.json();
      
      if (qvJson.ok) {
        setExpandedData(prev => ({ 
          ...prev, 
          [turmaId]: { 
            ...qvJson.data, 
            history: histJson.ok ? histJson.data : [] 
          } 
        }));
      }
    } catch (err) {
      console.error("Erro ao buscar quick view", err);
    } finally {
      setExpandedLoading(null);
    }
  }, [escolaId, expandedData]);

  const toggleExpand = (turmaId: string) => {
    if (expandedId === turmaId) {
      setExpandedId(null);
    } else {
      setExpandedId(turmaId);
      fetchQuickView(turmaId);
    }
  };
  const [toast,           setToast]           = useState<ToastState>(null);
  const [confirmOpen,     setConfirmOpen]     = useState(false);
  const [confirmLoading,  setConfirmLoading]  = useState(false);
  const [editingCell,     setEditingCell]     = useState<{ id: string; field: "sala" | "capacidade_maxima" } | null>(null);
  const [inlineLoading,   setInlineLoading]   = useState<string | null>(null);

  const handleInlineUpdate = async (turmaId: string, field: "sala" | "capacidade_maxima", value: string | number | null) => {
    if (!escolaId) return;
    setInlineLoading(`${turmaId}-${field}`);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas/${turmaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao atualizar");
      
      setItems(prev => prev.map(item => item.id === turmaId ? { ...item, [field]: value } : item));
      setEditingCell(null);
    } catch (err: any) {
      setToast({ message: err.message || "Erro ao salvar", type: "error" });
    } finally {
      setInlineLoading(null);
    }
  };

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
      if (filters.status  !== "todos" && filters.status !== "rascunho") {
        params.set("status", filters.status);
      }
      if (filters.curso   !== "todos") params.set("curso_id",  filters.curso);
      if (busca.trim())                params.set("busca",  busca.trim());
      params.set("limit", "100");
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

  const initialRender = useRef(true);

  useEffect(() => {
    if (escolaLoading || !escolaId) { if (!escolaLoading) setLoading(false); return; }
    
    // Skip first fetch if we have initialData
    if (initialRender.current && initialData) {
      initialRender.current = false;
      return;
    }

    const t = setTimeout(() => { setNextCursor(null); fetchData({ append: false }); }, 300);
    return () => clearTimeout(t);
  }, [fetchData, escolaId, escolaLoading, initialData]);

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

  // ── Pedagogico fetch (Fase 2) ─────────────────────────────────────────────
  useEffect(() => {
    if (!escolaId || !itemIds) { setPedagogicoStats({}); return; }
    fetch(buildEscolaUrl(escolaId, "/admin/turmas/stats-pedagogicos"))
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        const map: Record<string, PedagogicoTurmaStat> = {};
        (json.items || []).forEach((row: any) => {
          if (row?.turma_id) map[row.turma_id] = row;
        });
        setPedagogicoStats(map);
      })
      .catch(() => null);
  }, [escolaId, itemIds]);

  // ── Client-side filtering (for fields not sent to API) ────────────────────
  const filteredItems = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return items.filter((t) => {
      if (filters.curso !== "todos" && t.curso_id !== filters.curso) return false;
      if (query) {
        const haystack = [
          t.nome,
          t.turma_codigo,
          t.curso_nome,
          t.classe_nome,
          t.professor_nome,
          t.sala,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.status === "rascunho") {
        const pendenciaCurriculo = t.status_curriculo === "pendente";
        const pendenciaTurma = t.status_validacao === "rascunho";
        if (!pendenciaCurriculo && !pendenciaTurma) return false;
      }
      if (filters.status === "ativos" && t.status_validacao !== "ativo") return false;

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

      if (filters.espera === "com" && (pedagogicoStats[t.id]?.candidatos_espera ?? 0) === 0) return false;

      return true;
    });
  }, [items, filters, financeiroStats, busca]);

  const filteredIds = useMemo(() => filteredItems.map(t => t.id), [filteredItems]);

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
  const isInitialLoading = loading && items.length === 0;

  const rowVirtualizer = useVirtualizer({
    count:            displayRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize:     (i) => (displayRows[i]?.type === "expanded" ? 220 : 96),
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

  const detailHrefBase = adminMode && escolaParam
    ? `/escola/${escolaParam}/admin/turmas`
    : `${secretariaBase}/turmas`;

  const handleFilterChange = useCallback((next: Partial<ActiveFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 pb-24">

      {/* ... (Header, KPIs, Pending banner) ... */}

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

        {isInitialLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`turma-skeleton-${i}`} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "cards" ? (
          <SecretaryCardView
            items={filteredItems}
            detailHrefBase={detailHrefBase}
            secretariaBase={secretariaBase}
            pedagogicoStats={pedagogicoStats}
            onEdit={(t) => { setEditingTurma(t); setShowForm(true); }}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <div className="overflow-x-auto">
            <div ref={scrollParentRef} className="max-h-[600px] overflow-y-auto">
              <table className="min-w-full table-fixed divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0 z-10"
                  style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <tr>
                    <th className="px-5 py-3 text-left w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filteredIds.length}
                        onChange={() => toggleAll(filteredIds)}
                        className="w-4 h-4 rounded border-slate-300 text-klasse-gold-500 focus:ring-klasse-gold-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[26%]">Turma</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[22%]">Curso / Nível</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[12%]">Sala</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[10%]">Cap.</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[20%]">Saúde</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[10%]">Ações</th>
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
                        <td className="px-5 py-4 w-[40px]"><div className="h-4 w-4 bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-9 w-9 bg-slate-100 rounded-xl" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-full bg-slate-100 rounded" /></td>
                        <td className="px-5 py-4" />
                      </tr>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                      <td colSpan={7} className="py-20 text-center">
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
                        const qv = expandedData[row.turma.id];
                        const loading = expandedLoading === row.turma.id;

                        return (
                          <tr key={row.key} className="bg-slate-50/50" style={vs}>
                            <td colSpan={7} className="px-5 py-4">
                              <div className="ml-11 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Alunos em Risco */}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-rose-500" /> Alunos em Risco
                                  </h4>
                                  {loading ? (
                                    <div className="space-y-2 animate-pulse">
                                      <div className="h-4 bg-slate-100 rounded w-full" />
                                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    </div>
                                  ) : qv?.risks?.length > 0 ? (
                                    <div className="space-y-2">
                                      {qv.risks.map((r: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-xs">
                                          <span className="font-medium text-slate-700">{r.nome}</span>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            r.status === "critical" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                          }`}>
                                            {r.motivo}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 py-2">Sem alertas críticos no momento.</p>
                                  )}
                                </div>

                                {/* Aula Atual */}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                      <CalendarCheck size={12} className="text-[#1F6B3B]" /> Aula Atual / Próxima
                                    </span>
                                    {qv?.currentSubject && !substituting && (
                                      <button 
                                        onClick={() => { setSubstituting(row.turma.id); fetchProfessors(); }}
                                        className="text-[10px] font-bold text-klasse-gold-600 hover:text-klasse-gold-700 transition-colors"
                                      >
                                        Substituir
                                      </button>
                                    )}
                                  </h4>
                                  {loading ? (
                                    <div className="space-y-2 animate-pulse">
                                      <div className="h-4 bg-slate-100 rounded w-1/2" />
                                      <div className="h-4 bg-slate-100 rounded w-full" />
                                    </div>
                                  ) : substituting === row.turma.id ? (
                                    <div className="space-y-3 animate-in fade-in duration-200">
                                      <p className="text-xs font-semibold text-slate-600">Selecionar Substituto para {qv?.currentSubject?.nome}:</p>
                                      <select 
                                        value={selectedProf}
                                        onChange={(e) => setSelectedProf(e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-klasse-gold"
                                      >
                                        <option value="">Selecione um professor...</option>
                                        {professors.map(p => (
                                          <option key={p.teacher_id} value={p.teacher_id}>{p.nome}</option>
                                        ))}
                                      </select>
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => setSubstituting(null)}
                                          className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                        <button 
                                          onClick={() => handleAssignSubstitute(row.turma.id, qv.currentSubject.slot_id)}
                                          disabled={!selectedProf}
                                          className="px-3 py-1.5 text-[10px] font-bold bg-klasse-gold-500 text-white hover:bg-klasse-gold-600 rounded-lg shadow-sm transition-all disabled:opacity-50"
                                        >
                                          Confirmar
                                        </button>
                                      </div>
                                    </div>
                                  ) : qv?.currentSubject ? (
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{qv.currentSubject.nome}</p>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <UserCheck size={12} /> {qv.currentSubject.professor}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                                        <MapPin size={12} /> {qv.currentSubject.sala} · Agora
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 py-2">Sem aulas agendadas para este horário.</p>
                                  )}
                                </div>

                                {/* Log de Ocupação Histórica (Fase 4) */}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                                    <UsersRound size={12} className="text-blue-500" /> Evolução da Lotação
                                  </h4>
                                  {loading ? (
                                    <div className="space-y-2 animate-pulse">
                                      <div className="h-4 bg-slate-100 rounded w-full" />
                                      <div className="h-4 bg-slate-100 rounded w-full" />
                                    </div>
                                  ) : qv?.history?.length > 0 ? (
                                    <div className="space-y-2">
                                      {qv.history.slice(-4).map((h: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between text-[10px]">
                                          <span className="text-slate-500 font-medium">{h.mes_referencia}</span>
                                          <div className="flex items-center gap-2 flex-1 mx-3">
                                            <div className="h-1 bg-slate-100 rounded-full flex-1 overflow-hidden">
                                              <div 
                                                className="h-full bg-blue-400 rounded-full"
                                                style={{ width: `${Math.min((h.total_alunos / (row.turma.capacidade_maxima || 30)) * 100, 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                          <span className="font-bold text-slate-700 w-4 text-right">{h.total_alunos}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 py-2">Sem histórico disponível.</p>
                                  )}
                                </div>
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
                          onToggleExpand={() => toggleExpand(row.turma.id)}
                          onEdit={(t) => { setEditingTurma(t); setShowForm(true); }}
                          detailHrefBase={detailHrefBase}
                          secretariaBase={secretariaBase}
                          financeiro={financeiroStats[row.turma.id]}
                          pedagogico={pedagogicoStats[row.turma.id]}
                          style={vs}
                          editingCell={editingCell}
                          onStartEdit={(id, field) => setEditingCell({ id, field })}
                          onCancelEdit={() => setEditingCell(null)}
                          onSaveEdit={handleInlineUpdate}
                          loadingCell={inlineLoading}
                          isSelected={selectedIds.has(row.turma.id)}
                          onToggleSelect={toggleSelect}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
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

      {/* ── Bulk Actions Bar (Fase 3) ────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-8 duration-300 z-40 border border-slate-700/50 backdrop-blur-md">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-8">
            <div className="w-6 h-6 rounded-full bg-klasse-gold-500 text-slate-900 flex items-center justify-center text-xs font-bold">
              {selectedIds.size}
            </div>
            <span className="text-sm font-semibold text-slate-300">Selecionadas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPrint}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold group"
            >
              <Printer size={16} className="text-slate-400 group-hover:text-white transition-colors" />
              Impressão em Lote
            </button>
            <button
              onClick={handleBulkClose}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold group"
            >
              <Lock size={16} className="text-slate-400 group-hover:text-white transition-colors" />
              Fechamento em Bloco
            </button>
            <button
              onClick={handleBulkNotify}
              className="flex items-center gap-2 px-4 py-2 bg-klasse-gold-500 text-slate-900 hover:bg-klasse-gold-400 rounded-xl transition-all text-sm font-bold shadow-lg shadow-klasse-gold-500/20"
            >
              <Send size={16} />
              Notificar Encarregados
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-4 p-2 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-colors"
              title="Limpar seleção"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
