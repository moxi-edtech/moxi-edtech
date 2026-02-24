"use client";

import React, {
  use, useEffect, useState, useTransition,
  useCallback, useRef, useMemo,
} from "react";
import Link from "next/link";
import {
  Search, UserPlus, Archive, RotateCcw, Trash2, Edit,
  X, AlertTriangle, CheckCircle2, Loader2, Users,
  ChevronDown, RefreshCw, Filter, Download, FileText,
  FileSpreadsheet, MessageSquare, ArrowUpDown, CheckSquare,
  Square, Minus, DollarSign, AlertCircle, Clock,
  ChevronRight, CreditCard, Banknote, Smartphone, Receipt,
  SlidersHorizontal, XCircle, TrendingDown,
} from "lucide-react";

// ═════════════════════════════════════════════════════════════════════════════
// Tipos
// ═════════════════════════════════════════════════════════════════════════════

type SituacaoFinanceira = "em_dia" | "em_atraso" | "sem_registo";
type StatusMatricula    = "matriculado" | "sem_matricula" | "pendente";
type MetodoPagamento    = "numerario" | "transferencia" | "multicaixa" | "referencia";

type Aluno = {
  id:                  string;
  nome:                string | null;
  email:               string | null;
  numero_login:        string | null;
  numero_processo?:    string | null;
  created_at:          string;
  status?:             string | null;
  origem?:             "aluno" | "candidatura" | null;
  turma_nome?:         string | null;
  turma_id?:           string | null;
  turma_codigo?:       string | null;
  turma_ano?:          number | null;
  turma_curso?:        string | null;
  situacao_financeira: SituacaoFinanceira;
  meses_atraso?:       number;
  valor_em_divida?:    number;
  status_matricula:    StatusMatricula;
};

type Turma = {
  id: string;
  nome: string;
  turma_codigo?: string | null;
  ano_letivo?: number | null;
  curso?: string | null;
};

type Filtros = {
  situacao_financeira: SituacaoFinanceira | "";
  turma_id:            string;
  status_matricula:    StatusMatricula | "";
  ano_letivo_id:       string;
};

// ═════════════════════════════════════════════════════════════════════════════
// Helpers visuais
// ═════════════════════════════════════════════════════════════════════════════

function formatKz(valor?: number) {
  if (!valor) return null;
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(valor);
}

function SituacaoFinanceiraChip({ situacao, meses, valor }: {
  situacao: SituacaoFinanceira;
  meses?:   number;
  valor?:   number;
}) {
  if (situacao === "em_dia") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#1F6B3B]/10
      px-2.5 py-1 text-[11px] font-bold text-[#1F6B3B]">
      <CheckCircle2 size={10} /> Em dia
    </span>
  );

  if (situacao === "em_atraso") return (
    <div>
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100
        px-2.5 py-1 text-[11px] font-bold text-rose-700">
        <AlertCircle size={10} />
        {meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "Em atraso"}
      </span>
      {valor && (
        <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{formatKz(valor)}</p>
      )}
    </div>
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100
      px-2.5 py-1 text-[11px] font-medium text-slate-500">
      <Minus size={10} /> Sem registo
    </span>
  );
}

function MatriculaBadge({ status }: { status: StatusMatricula }) {
  const cfg = {
    matriculado:    { bg: "bg-[#1F6B3B]/8 text-[#1F6B3B]",  label: "Matriculado" },
    sem_matricula:  { bg: "bg-slate-100 text-slate-500",      label: "Sem matrícula" },
    pendente:       { bg: "bg-[#E3B23C]/10 text-[#9a7010]",  label: "Pendente" },
  }[status] ?? { bg: "bg-slate-100 text-slate-500", label: "Sem matrícula" };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Modal de confirmação
// ═════════════════════════════════════════════════════════════════════════════

type ModalConfig = {
  open:    boolean;
  title:   string;
  message: string;
  confirm: string;
  danger?: boolean;
  loading?: boolean;
  action:  () => Promise<void>;
};

function ConfirmModal({ cfg, onConfirm, onCancel }: {
  cfg:       ModalConfig;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  useEffect(() => {
    if (!cfg.open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cfg.open, onCancel]);

  if (!cfg.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200
        w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 p-2.5 rounded-xl ${cfg.danger ? "bg-rose-100" : "bg-[#E3B23C]/10"}`}>
            <AlertTriangle size={20} className={cfg.danger ? "text-rose-600" : "text-[#E3B23C]"} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900">{cfg.title}</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{cfg.message}</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={cfg.loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={cfg.loading}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white
              transition-colors disabled:opacity-50
              ${cfg.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1F6B3B] hover:bg-[#185830]"}`}>
            {cfg.loading && <Loader2 size={13} className="animate-spin" />}
            {cfg.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Toast inline
// ═════════════════════════════════════════════════════════════════════════════

type ToastState = { type: "success" | "error"; message: string } | null;

function InlineToast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.type === "success" ? 3500 : 0);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl
      px-4 py-3 shadow-xl animate-in slide-in-from-bottom-2 duration-200
      ${toast.type === "success" ? "bg-[#1F6B3B]" : "bg-rose-600"}`}>
      {toast.type === "success"
        ? <CheckCircle2 size={15} className="text-white flex-shrink-0" />
        : <AlertTriangle size={15} className="text-white flex-shrink-0" />
      }
      <p className="text-sm font-semibold text-white">{toast.message}</p>
      {toast.type === "error" && (
        <button onClick={onDismiss} className="text-white/70 hover:text-white ml-1">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Drawer de pagamento rápido
// ═════════════════════════════════════════════════════════════════════════════

function PagamentoDrawer({ aluno, onClose, onSuccess }: {
  aluno:     Aluno | null;
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}) {
  const [valor,   setValor]   = useState("");
  const [metodo,  setMetodo]  = useState<MetodoPagamento>("numerario");
  const [ref,     setRef]     = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aluno) {
      setValor(aluno.valor_em_divida ? String(aluno.valor_em_divida) : "");
      setMetodo("numerario");
      setRef("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aluno]);

  useEffect(() => {
    if (!aluno) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aluno, onClose]);

  const metodos: Array<{ id: MetodoPagamento; label: string; icon: React.ReactNode }> = [
    { id: "numerario",    label: "Numerário",    icon: <Banknote size={14} /> },
    { id: "transferencia",label: "Transferência", icon: <ArrowUpDown size={14} /> },
    { id: "multicaixa",   label: "Multicaixa",   icon: <CreditCard size={14} /> },
    { id: "referencia",   label: "Referência",   icon: <Smartphone size={14} /> },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aluno || !valor || Number(valor) <= 0) return;
    setLoading(true);
    try {
      const idempotencyKey = `pag-${aluno.id}-${Date.now()}`;
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/pagamento-rapido`, {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          valor:       Number(valor),
          metodo_pagamento: metodo,
          referencia:  ref || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao registar pagamento.");
      onSuccess(`Pagamento de ${formatKz(Number(valor))} registado para ${aluno.nome}.`);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity
          ${aluno ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl
        border-l border-slate-200 flex flex-col transition-transform duration-300
        ${aluno ? "translate-x-0" : "translate-x-full"}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#1F6B3B]/10">
              <Receipt size={16} className="text-[#1F6B3B]" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Registar Pagamento</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">
                {aluno?.nome ?? "—"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Situação actual */}
        {aluno && (
          <div className={`mx-5 mt-5 rounded-xl px-4 py-3
            ${aluno.situacao_financeira === "em_atraso"
              ? "bg-rose-50 border border-rose-200"
              : "bg-slate-50 border border-slate-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Situação actual
            </p>
            <div className="flex items-center justify-between">
              <SituacaoFinanceiraChip
                situacao={aluno.situacao_financeira}
                meses={aluno.meses_atraso}
                valor={aluno.valor_em_divida}
              />
              {aluno.valor_em_divida && (
                <span className="text-sm font-black text-rose-700">
                  {formatKz(aluno.valor_em_divida)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Valor */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              Valor a registar (Kz) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                Kz
              </span>
              <input
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                required
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200
                  text-base font-bold focus:outline-none focus:ring-2
                  focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                placeholder="0"
              />
            </div>
          </div>

          {/* Método */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              Método de pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {metodos.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodo(m.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5
                    text-sm font-semibold transition-all
                    ${metodo === m.id
                      ? "border-[#1F6B3B] bg-[#1F6B3B]/5 text-[#1F6B3B]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Referência (opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              Referência / Nº comprovativo <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={ref}
              onChange={e => setRef(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
              placeholder="Ex: TRF-2026-00123"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          <button
            onClick={submit as any}
            disabled={loading || !valor || Number(valor) <= 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl
              bg-[#1F6B3B] py-3 text-sm font-bold text-white
              hover:bg-[#185830] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> A registar…</>
              : <><Receipt size={14} /> Registar pagamento</>
            }
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm
              font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Barra contextual de selecção múltipla
// ═════════════════════════════════════════════════════════════════════════════

function SelectionBar({ selected, total, onClear, onArchive, onMessage, onExportSelection }: {
  selected:          Set<string>;
  total:             number;
  onClear:           () => void;
  onArchive:         () => void;
  onMessage:         () => void;
  onExportSelection: () => void;
}) {
  const count = selected.size;
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30
      flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5
      shadow-2xl shadow-black/30 animate-in slide-in-from-bottom-3 duration-200 border border-slate-700">

      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E3B23C] text-xs font-black text-slate-900">
          {count}
        </div>
        <span className="text-sm font-semibold text-white">
          {count === 1 ? "aluno seleccionado" : "alunos seleccionados"}
        </span>
        <span className="text-slate-600 text-xs">de {total}</span>
      </div>

      <div className="h-4 w-px bg-slate-700 mx-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={onExportSelection}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700
            px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500
            hover:text-white transition-colors"
        >
          <Download size={12} /> Exportar
        </button>
        <button
          onClick={onMessage}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700
            px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500
            hover:text-white transition-colors"
        >
          <MessageSquare size={12} /> Comunicado
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700
            px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-amber-500
            hover:text-amber-400 transition-colors"
        >
          <Archive size={12} /> Arquivar
        </button>
      </div>

      <div className="h-4 w-px bg-slate-700 mx-1" />

      <button
        onClick={onClear}
        className="text-slate-500 hover:text-white transition-colors"
        title="Limpar selecção"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Painel de filtros
// ═════════════════════════════════════════════════════════════════════════════

const FILTROS_VAZIOS: Filtros = {
  situacao_financeira: "",
  turma_id:            "",
  status_matricula:    "",
  ano_letivo_id:       "",
};

function FiltrosPanel({ filtros, turmas, onChange, onClose, activeCount }: {
  filtros:     Filtros;
  turmas:      Turma[];
  onChange:    (f: Filtros) => void;
  onClose:     () => void;
  activeCount: number;
}) {
  const [local, setLocal] = useState(filtros);

  const apply = () => { onChange(local); onClose(); };
  const reset = () => { setLocal(FILTROS_VAZIOS); onChange(FILTROS_VAZIOS); onClose(); };

  return (
    <div className="absolute right-0 top-full mt-2 z-20 w-80 rounded-2xl bg-white
      border border-slate-200 shadow-xl animate-in slide-in-from-top-2 duration-150">

      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-900">Filtros</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Situação financeira */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Situação financeira
          </label>
          <div className="space-y-1.5">
            {[
              { value: "",           label: "Todas" },
              { value: "em_dia",     label: "✅ Em dia" },
              { value: "em_atraso",  label: "🔴 Em atraso" },
              { value: "sem_registo",label: "— Sem registo" },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="situacao"
                  value={opt.value}
                  checked={local.situacao_financeira === opt.value}
                  onChange={() => setLocal(f => ({ ...f, situacao_financeira: opt.value as any }))}
                  className="accent-[#1F6B3B]"
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Turma */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Turma
          </label>
          <select
            value={local.turma_id}
            onChange={e => setLocal(f => ({ ...f, turma_id: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30"
          >
            <option value="">Todas as turmas</option>
            {turmas.map(t => (
              <option key={t.id} value={t.id}>
                {t.turma_codigo || t.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Status matrícula */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Estado de matrícula
          </label>
          <div className="space-y-1.5">
            {[
              { value: "",              label: "Todos" },
              { value: "matriculado",   label: "Matriculado" },
              { value: "sem_matricula", label: "Sem matrícula" },
              { value: "pendente",      label: "Pendente" },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="matricula"
                  value={opt.value}
                  checked={local.status_matricula === opt.value}
                  onChange={() => setLocal(f => ({ ...f, status_matricula: opt.value as any }))}
                  className="accent-[#1F6B3B]"
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100">
        <button
          onClick={reset}
          className="flex-1 rounded-xl border border-slate-200 py-2 text-sm
            font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Limpar
        </button>
        <button
          onClick={apply}
          className="flex-1 rounded-xl bg-[#1F6B3B] py-2 text-sm
            font-bold text-white hover:bg-[#185830] transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Dropdown de exportação
// ═════════════════════════════════════════════════════════════════════════════

function ExportDropdown({ onExport, onClose, hasFilters }: {
  onExport:   (tipo: "excel" | "pdf") => void;
  onClose:    () => void;
  hasFilters: boolean;
}) {
  useEffect(() => {
    const h = (e: MouseEvent) => onClose();
    setTimeout(() => window.addEventListener("click", h), 0);
    return () => window.removeEventListener("click", h);
  }, [onClose]);

  return (
    <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-2xl bg-white
      border border-slate-200 shadow-xl animate-in slide-in-from-top-2 duration-150 overflow-hidden">

      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-700">Exportar lista</p>
        {hasFilters && (
          <p className="text-[10px] text-slate-400 mt-0.5">Aplica os filtros activos</p>
        )}
      </div>

      <button
        onClick={() => onExport("excel")}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="p-2 rounded-lg bg-green-50">
          <FileSpreadsheet size={14} className="text-green-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Excel (.xlsx)</p>
          <p className="text-[10px] text-slate-400">Com dados financeiros e turma</p>
        </div>
      </button>

      <button
        onClick={() => onExport("pdf")}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
      >
        <div className="p-2 rounded-lg bg-rose-50">
          <FileText size={14} className="text-rose-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">PDF oficial</p>
          <p className="text-[10px] text-slate-400">Nome, número, turma, ano lectivo</p>
        </div>
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Skeleton de linha
// ═════════════════════════════════════════════════════════════════════════════

function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4"><div className="h-4 w-4 rounded bg-slate-100" /></td>
      {[50, 160, 100, 90, 80, 60].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded-lg bg-slate-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Página principal
// ═════════════════════════════════════════════════════════════════════════════

export default function AlunosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = use(params);

  // ── Estado principal ────────────────────────────────────────────────────────
  const [tab,          setTab]          = useState<"ativos" | "arquivados">("ativos");
  const [q,            setQ]            = useState("");
  const [alunos,       setAlunos]       = useState<Aluno[]>([]);
  const [turmas,       setTurmas]       = useState<Turma[]>([]);
  const [nextCursor,   setNextCursor]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [creating,     startCreate]     = useTransition();
  const [toast,        setToast]        = useState<ToastState>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [invite,       setInvite]       = useState({ nome: "", email: "" });

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [filtros,      setFiltros]      = useState<Filtros>(FILTROS_VAZIOS);
  const [showFiltros,  setShowFiltros]  = useState(false);

  // ── Exportação ──────────────────────────────────────────────────────────────
  const [showExport,   setShowExport]   = useState(false);
  const [exporting,    setExporting]    = useState(false);

  // ── Selecção múltipla ───────────────────────────────────────────────────────
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  // ── Drawer de pagamento ─────────────────────────────────────────────────────
  const [drawerAluno,  setDrawerAluno]  = useState<Aluno | null>(null);

  // ── Modal de confirmação ────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalConfig>({
    open: false, title: "", message: "", confirm: "", action: async () => {},
  });

  const filtrosActivos = useMemo(() =>
    Object.values(filtros).filter(Boolean).length, [filtros]);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchAlunos = useCallback(async (opts?: { cursor?: string | null; append?: boolean }) => {
    opts?.append ? setLoadingMore(true) : setLoading(true);
    try {
      const url = new URL(`/api/escolas/${escolaId}/admin/alunos`, window.location.origin);
      url.searchParams.set("status", tab === "ativos" ? "active" : "archived");
      if (q.trim())                        url.searchParams.set("q", q.trim());
      if (filtros.situacao_financeira)     url.searchParams.set("situacao_financeira", filtros.situacao_financeira);
      if (filtros.turma_id)                url.searchParams.set("turma_id", filtros.turma_id);
      if (filtros.status_matricula)        url.searchParams.set("status_matricula", filtros.status_matricula);
      url.searchParams.set("limit", "30");
      if (opts?.cursor)                    url.searchParams.set("cursor", opts.cursor);

      const res  = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao listar alunos.");

      opts?.append
        ? setAlunos(prev => [...prev, ...(json.items ?? [])])
        : setAlunos(json.items ?? []);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setToast({ type: "error", message: e.message });
      if (!opts?.append) setAlunos([]);
    } finally {
      opts?.append ? setLoadingMore(false) : setLoading(false);
    }
  }, [escolaId, tab, q, filtros]);

  useEffect(() => {
    setNextCursor(null);
    setSelected(new Set());
    fetchAlunos();
  }, [tab, filtros]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/escolas/${escolaId}/admin/turmas?limit=100`)
      .then(r => r.json())
      .then(j => setTurmas(j.items ?? []))
      .catch(() => {});
  }, [escolaId]);

  // ── Selecção ────────────────────────────────────────────────────────────────

  const allSelected = alunos.length > 0 && alunos.every(a => selected.has(a.id));
  const someSelected = !allSelected && alunos.some(a => selected.has(a.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(alunos.map(a => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Acções sobre alunos ─────────────────────────────────────────────────────

  const openModal = (config: Omit<ModalConfig, "open" | "loading">) =>
    setModal({ ...config, open: true, loading: false });

  const runModal = async () => {
    setModal(m => ({ ...m, loading: true }));
    try {
      await modal.action();
      setModal(m => ({ ...m, open: false }));
      fetchAlunos();
    } catch (e: any) {
      setToast({ type: "error", message: e.message });
      setModal(m => ({ ...m, open: false }));
    }
  };

  const archiveOne = (aluno: Aluno) => openModal({
    title:   "Arquivar aluno",
    message: `"${aluno.nome}" ficará arquivado e não poderá aceder ao sistema. Podes restaurar mais tarde.`,
    confirm: "Arquivar",
    action:  async () => {
      const res  = await fetch(`/api/secretaria/alunos/${aluno.id}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Arquivado via Admin" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao arquivar.");
      setToast({ type: "success", message: `${aluno.nome} arquivado.` });
      setSelected(s => { const n = new Set(s); n.delete(aluno.id); return n; });
    },
  });

  const archiveSelected = () => openModal({
    title:   `Arquivar ${selected.size} alunos`,
    message: `Os ${selected.size} alunos seleccionados ficarão arquivados. Podes restaurá-los mais tarde.`,
    confirm: "Arquivar todos",
    action:  async () => {
      await Promise.all(
        [...selected].map(id =>
          fetch(`/api/secretaria/alunos/${id}/delete`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Arquivado em lote" }),
          })
        )
      );
      setToast({ type: "success", message: `${selected.size} alunos arquivados.` });
      setSelected(new Set());
    },
  });

  const restoreOne = (aluno: Aluno) => openModal({
    title:   "Restaurar aluno",
    message: `"${aluno.nome}" voltará a ter acesso ao sistema.`,
    confirm: "Restaurar",
    action:  async () => {
      const res  = await fetch(`/api/secretaria/alunos/${aluno.id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao restaurar.");
      setToast({ type: "success", message: `${aluno.nome} restaurado.` });
    },
  });

  const hardDelete = (aluno: Aluno) => openModal({
    title:   "Eliminar permanentemente",
    message: `Esta acção é irreversível. Todos os dados de "${aluno.nome}" serão apagados definitivamente.`,
    confirm: "Eliminar permanentemente",
    danger:  true,
    action:  async () => {
      const res  = await fetch(`/api/secretaria/alunos/${aluno.id}/hard-delete`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao eliminar.");
      setToast({ type: "success", message: "Aluno eliminado." });
    },
  });

  // ── Exportação ──────────────────────────────────────────────────────────────

  const handleExport = async (tipo: "excel" | "pdf") => {
    setShowExport(false);
    setExporting(true);
    try {
      const url = new URL(`/api/escolas/${escolaId}/admin/alunos/exportar`, window.location.origin);
      url.searchParams.set("tipo", tipo);
      url.searchParams.set("status", tab === "ativos" ? "active" : "archived");
      if (q.trim())                    url.searchParams.set("q", q.trim());
      if (filtros.situacao_financeira) url.searchParams.set("situacao_financeira", filtros.situacao_financeira);
      if (filtros.turma_id)            url.searchParams.set("turma_id", filtros.turma_id);
      if (filtros.status_matricula)    url.searchParams.set("status_matricula", filtros.status_matricula);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Falha na exportação.");

      const blob     = await res.blob();
      const blobUrl  = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = blobUrl;
      a.download     = `alunos-${tab}-${Date.now()}.${tipo === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      setToast({ type: "success", message: `Lista exportada em ${tipo === "excel" ? "Excel" : "PDF"}.` });
    } catch (e: any) {
      setToast({ type: "error", message: e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleExportSelection = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/admin/alunos/exportar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], tipo: "excel" }),
      });
      if (!res.ok) throw new Error("Falha na exportação.");
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = `alunos-seleccionados-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      setToast({ type: "success", message: `${selected.size} alunos exportados.` });
    } catch (e: any) {
      setToast({ type: "error", message: e.message });
    } finally {
      setExporting(false);
    }
  };

  // ── Convidar aluno ──────────────────────────────────────────────────────────

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.nome.trim() || !invite.email.trim()) {
      setToast({ type: "error", message: "Preenche o nome e o e-mail." });
      return;
    }
    startCreate(async () => {
      try {
        const res  = await fetch(`/api/escolas/${escolaId}/usuarios/invite`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: invite.nome.trim(), email: invite.email.trim(), papel: "aluno" }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao criar aluno.");
        setInvite({ nome: "", email: "" });
        setShowForm(false);
        if (tab !== "ativos") setTab("ativos");
        setToast({ type: "success", message: `${invite.nome} adicionado com sucesso.` });
        fetchAlunos();
      } catch (e: any) {
        setToast({ type: "error", message: e.message });
      }
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ConfirmModal cfg={modal} onConfirm={runModal}
        onCancel={() => setModal(m => ({ ...m, open: false }))} />

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />

      <PagamentoDrawer
        aluno={drawerAluno}
        onClose={() => setDrawerAluno(null)}
        onSuccess={msg => { setToast({ type: "success", message: msg }); fetchAlunos(); }}
      />

      <SelectionBar
        selected={selected}
        total={alunos.length}
        onClear={() => setSelected(new Set())}
        onArchive={archiveSelected}
        onMessage={() => setToast({ type: "error", message: "Comunicados — em breve." })}
        onExportSelection={handleExportSelection}
      />

      <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Gestão de Alunos
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {tab === "ativos" ? "Alunos activos na escola" : "Alunos arquivados"}
              {filtrosActivos > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full
                  bg-[#E3B23C]/10 px-2 py-0.5 text-[10px] font-bold text-[#9a7010]">
                  {filtrosActivos} filtro{filtrosActivos !== 1 ? "s" : ""} activo{filtrosActivos !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setTab(t => t === "ativos" ? "arquivados" : "ativos"); setQ(""); setFiltros(FILTROS_VAZIOS); }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white
                px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300
                hover:bg-slate-50 transition-all shadow-sm"
            >
              {tab === "ativos" ? <><Archive size={14} /> Arquivados</> : <><Users size={14} /> Activos</>}
            </button>

            {tab === "ativos" && (
              <button
                onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2.5
                  text-sm font-bold text-white hover:bg-[#185830] transition-colors shadow-sm"
              >
                <UserPlus size={14} /> Adicionar aluno
              </button>
            )}
          </div>
        </div>

        {/* ── Formulário colapsável ──────────────────────────────────────── */}
        {showForm && tab === "ativos" && (
          <form onSubmit={submitInvite}
            className="rounded-2xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-5
              animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-[#1F6B3B]">Novo aluno</p>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Nome completo</label>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                  placeholder="Ex: João Baptista"
                  value={invite.nome}
                  onChange={e => setInvite(v => ({ ...v, nome: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1.5">E-mail</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                  placeholder="Ex: joao@escola.ao"
                  value={invite.email}
                  onChange={e => setInvite(v => ({ ...v, email: e.target.value }))}
                />
              </div>
              <button type="submit" disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-5 py-2.5
                  text-sm font-bold text-white hover:bg-[#185830] transition-colors
                  disabled:opacity-50 flex-shrink-0">
                {creating
                  ? <><Loader2 size={13} className="animate-spin" /> A criar…</>
                  : <><UserPlus size={13} /> Adicionar</>
                }
              </button>
            </div>
          </form>
        )}

        {/* ── Barra de pesquisa + filtros + exportar ─────────────────────── */}
        <div className="flex items-center gap-2">
          <form onSubmit={e => { e.preventDefault(); setNextCursor(null); fetchAlunos(); }}
            className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Pesquisar por nome, número de login ou ID…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white
                  text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30
                  focus:border-[#1F6B3B] shadow-sm"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              {q && (
                <button type="button"
                  onClick={() => { setQ(""); fetchAlunos(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
                font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
              Pesquisar
            </button>
          </form>

          {/* Filtros */}
          <div className="relative">
            <button
              onClick={() => setShowFiltros(f => !f)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm
                font-semibold shadow-sm transition-all
                ${filtrosActivos > 0
                  ? "border-[#1F6B3B] bg-[#1F6B3B]/5 text-[#1F6B3B]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <SlidersHorizontal size={14} />
              Filtros
              {filtrosActivos > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full
                  bg-[#1F6B3B] text-[9px] font-black text-white">
                  {filtrosActivos}
                </span>
              )}
            </button>
            {showFiltros && (
              <FiltrosPanel
                filtros={filtros}
                turmas={turmas}
                onChange={f => { setFiltros(f); setNextCursor(null); }}
                onClose={() => setShowFiltros(false)}
                activeCount={filtrosActivos}
              />
            )}
          </div>

          {/* Exportar */}
          <div className="relative">
            <button
              onClick={() => setShowExport(e => !e)}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white
                px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50
                shadow-sm transition-colors disabled:opacity-50"
            >
              {exporting
                ? <Loader2 size={14} className="animate-spin" />
                : <Download size={14} />
              }
              Exportar
            </button>
            {showExport && (
              <ExportDropdown
                onExport={handleExport}
                onClose={() => setShowExport(false)}
                hasFilters={filtrosActivos > 0}
              />
            )}
          </div>

          <button onClick={() => fetchAlunos()}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500
              hover:bg-slate-50 shadow-sm transition-colors" title="Actualizar">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* ── Chips de filtros activos ───────────────────────────────────── */}
        {filtrosActivos > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold">Filtros:</span>
            {filtros.situacao_financeira && (
              <button onClick={() => setFiltros(f => ({ ...f, situacao_financeira: "" }))}
                className="flex items-center gap-1.5 rounded-full border border-slate-200
                  bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300
                  hover:text-rose-600 transition-colors">
                {filtros.situacao_financeira === "em_dia" ? "Em dia"
                  : filtros.situacao_financeira === "em_atraso" ? "Em atraso"
                  : "Sem registo"}
                <X size={10} />
              </button>
            )}
            {filtros.turma_id && (
              <button onClick={() => setFiltros(f => ({ ...f, turma_id: "" }))}
                className="flex items-center gap-1.5 rounded-full border border-slate-200
                  bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300
                  hover:text-rose-600 transition-colors">
                {turmas.find(t => t.id === filtros.turma_id)?.turma_codigo
                  || turmas.find(t => t.id === filtros.turma_id)?.nome
                  || "Turma"}
                <X size={10} />
              </button>
            )}
            {filtros.status_matricula && (
              <button onClick={() => setFiltros(f => ({ ...f, status_matricula: "" }))}
                className="flex items-center gap-1.5 rounded-full border border-slate-200
                  bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300
                  hover:text-rose-600 transition-colors">
                {filtros.status_matricula}
                <X size={10} />
              </button>
            )}
            <button onClick={() => setFiltros(FILTROS_VAZIOS)}
              className="text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors">
              Limpar tudo
            </button>
          </div>
        )}

        {/* ── Tabela ───────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full
                ${tab === "ativos" ? "bg-[#1F6B3B]" : "bg-[#E3B23C]"}`} />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {tab === "ativos" ? "Alunos activos" : "Alunos arquivados"}
              </span>
              {!loading && (
                <span className="text-xs text-slate-400">
                  — {alunos.length}{nextCursor ? "+" : ""} registos
                </span>
              )}
            </div>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <XCircle size={12} /> Limpar selecção
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {/* Checkbox seleccionar tudo */}
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll}
                      className="text-slate-400 hover:text-[#1F6B3B] transition-colors">
                      {allSelected
                        ? <CheckSquare size={16} className="text-[#1F6B3B]" />
                        : someSelected
                        ? <Minus size={16} className="text-[#E3B23C]" />
                        : <Square size={16} />
                      }
                    </button>
                  </th>
                  {["Nº Processo", "Aluno", "Turma", "Situação Financeira", "Matrícula", "Acções"].map((h, i) => (
                    <th key={h}
                      className={`px-4 py-3 text-left text-[10px] font-bold uppercase
                        tracking-widest text-slate-400 ${i === 5 ? "text-center" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
                ) : alunos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={28} className="text-slate-200" />
                        <p className="text-sm font-semibold text-slate-400">
                          Nenhum aluno encontrado.
                        </p>
                        {(q || filtrosActivos > 0) && (
                          <button
                            onClick={() => { setQ(""); setFiltros(FILTROS_VAZIOS); fetchAlunos(); }}
                            className="mt-1 text-xs text-[#1F6B3B] font-semibold hover:underline"
                          >
                            Limpar pesquisa e filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  alunos.map(aluno => {
                    const isSelected = selected.has(aluno.id);
                    return (
                      <tr key={aluno.id}
                        className={`group transition-colors
                          ${isSelected ? "bg-[#1F6B3B]/5" : "hover:bg-slate-50/80"}`}>

                        {/* Checkbox */}
                        <td className="px-4 py-3.5">
                          <button onClick={() => toggleOne(aluno.id)}
                            className="text-slate-300 hover:text-[#1F6B3B] transition-colors">
                            {isSelected
                              ? <CheckSquare size={16} className="text-[#1F6B3B]" />
                              : <Square size={16} />
                            }
                          </button>
                        </td>

                        {/* Nº Processo */}
                        <td className="px-4 py-3.5">
                          {aluno.numero_login || aluno.numero_processo
                            ? <span className="font-mono text-sm font-semibold text-slate-700">
                                {aluno.numero_login || aluno.numero_processo}
                              </span>
                            : <span className="text-xs text-slate-300">—</span>
                          }
                        </td>

                        {/* Nome */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-[#1F6B3B]/10 flex items-center
                              justify-center flex-shrink-0 text-xs font-black text-[#1F6B3B]">
                              {aluno.nome?.charAt(0).toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{aluno.nome ?? "—"}</p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {aluno.id.slice(0, 8)}…
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Turma */}
                        <td className="px-4 py-3.5">
                          {aluno.turma_codigo ? (
                            <span className="font-bold text-slate-900">
                              {aluno.turma_codigo}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Situação financeira */}
                        <td className="px-4 py-3.5">
                          <SituacaoFinanceiraChip
                            situacao={aluno.situacao_financeira}
                            meses={aluno.meses_atraso}
                            valor={aluno.valor_em_divida}
                          />
                        </td>

                        {/* Matrícula */}
                        <td className="px-4 py-3.5">
                          <MatriculaBadge status={aluno.status_matricula} />
                        </td>

                        {/* Acções */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1
                            opacity-0 group-hover:opacity-100 transition-opacity">
                            {tab === "ativos" ? (
                              <>
                                <Link href={`/escola/${escolaId}/admin/alunos/${aluno.id}`}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200
                                    px-2 py-1.5 text-xs font-semibold text-slate-600
                                    hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors"
                                  title="Ver perfil">
                                  <ChevronRight size={12} />
                                </Link>
                                {aluno.situacao_financeira !== "sem_registo" && (
                                  <button
                                    onClick={() => setDrawerAluno(aluno)}
                                    className="flex items-center gap-1 rounded-lg border border-slate-200
                                      px-2 py-1.5 text-xs font-semibold text-slate-600
                                      hover:border-[#E3B23C] hover:text-[#9a7010] transition-colors"
                                    title="Registar pagamento"
                                  >
                                    <DollarSign size={12} />
                                  </button>
                                )}
                                <button onClick={() => archiveOne(aluno)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200
                                    px-2 py-1.5 text-xs font-semibold text-slate-500
                                    hover:border-amber-300 hover:text-amber-600 transition-colors"
                                  title="Arquivar">
                                  <Archive size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => restoreOne(aluno)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200
                                    px-2 py-1.5 text-xs font-semibold text-slate-600
                                    hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors">
                                  <RotateCcw size={12} />
                                </button>
                                <button onClick={() => hardDelete(aluno)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200
                                    px-2 py-1.5 text-xs font-semibold text-slate-500
                                    hover:border-rose-300 hover:text-rose-600 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {nextCursor && !loading && (
            <div className="flex justify-center border-t border-slate-100 bg-slate-50/30 p-4">
              <button
                onClick={() => fetchAlunos({ cursor: nextCursor, append: true })}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5
                  text-sm font-semibold text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
              >
                {loadingMore
                  ? <><Loader2 size={13} className="animate-spin" /> A carregar…</>
                  : <><ChevronDown size={13} /> Carregar mais</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
