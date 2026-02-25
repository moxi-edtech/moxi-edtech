"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  Loader2,
  Mail,
  Minus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  SlidersHorizontal,
  Slash,
  Smartphone,
  UserCheck,
  Users,
  X,
} from "lucide-react";

type TabStatus = "leads" | "ativos" | "inativos" | "arquivados";
type SituacaoFinanceira = "em_dia" | "em_atraso" | "sem_registo";
type MetodoPagamento = "numerario" | "transferencia" | "multicaixa" | "referencia";

type Aluno = {
  id: string;
  nome: string;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  status?: string | null;
  created_at: string;
  numero_login?: string | null;
  numero_processo?: string | null;
  origem?: "aluno" | "candidatura" | null;
  candidatura_id?: string | null;
  situacao_financeira?: SituacaoFinanceira;
  meses_atraso?: number;
  valor_em_divida?: number;
};

type Cursor = { created_at: string; id: string };

type ApiResponse = {
  ok: boolean;
  items: Aluno[];
  total?: number;
  page?: { hasMore?: boolean; nextCursor?: Cursor | null };
  error?: string;
};

type AlunoDetail = {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  status?: string | null;
  numero_login?: string | null;
  turma_id?: string | null;
  turma_nome?: string | null;
  turma_curso?: string | null;
  data_nascimento?: string | null;
  sexo?: string | null;
  bi_numero?: string | null;
  naturalidade?: string | null;
  provincia?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  encarregado_relacao?: string | null;
};

type OfflineMeta = { fromCache: boolean; updatedAt: string | null };
type Filters = { ano: string; turmaId: string };
type TurmaOption = { id: string; nome: string; ano_letivo?: number | null };

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type BreadcrumbItem = { label: string; href?: string };

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1 text-xs font-semibold text-slate-400">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && <Slash size={10} className="text-slate-300" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-[#1F6B3B] transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-600">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type TabDef = {
  id: TabStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const TABS: TabDef[] = [
  { id: "leads", label: "Leads", icon: <Clock size={13} />, color: "bg-amber-100 text-amber-800" },
  {
    id: "ativos",
    label: "Activos",
    icon: <UserCheck size={13} />,
    color: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
  },
  {
    id: "inativos",
    label: "Inativos",
    icon: <AlertCircle size={13} />,
    color: "bg-slate-100 text-slate-500",
  },
  {
    id: "arquivados",
    label: "Arquivados",
    icon: <Archive size={13} />,
    color: "bg-rose-100 text-rose-600",
  },
];

function TabBar({
  active,
  counts,
  onChange,
}: {
  active: TabStatus;
  counts: Partial<Record<TabStatus, number>>;
  onChange: (tab: TabStatus) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 -mb-px">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all",
              isActive
                ? "border-[#1F6B3B] text-[#1F6B3B]"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300",
            ].join(" ")}
          >
            {tab.icon}
            {tab.label}
            {count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive ? tab.color : "bg-slate-100 text-slate-400"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const st = (status || "pendente").toLowerCase();
  const map: Record<string, string> = {
    ativo: "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20",
    matriculado: "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20",
    pendente: "bg-amber-50 text-amber-800 border-amber-200",
    submetida: "bg-amber-50 text-amber-800 border-amber-200",
    em_analise: "bg-sky-50 text-sky-700 border-sky-200",
    aprovada: "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20",
    suspenso: "bg-amber-50 text-amber-800 border-amber-200",
    inativo: "bg-rose-50 text-rose-700 border-rose-200",
    arquivado: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${
        map[st] ?? map.pendente
      }`}
    >
      {st.replace(/_/g, " ")}
    </span>
  );
}

function formatKz(valor?: number) {
  if (!valor) return null;
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(valor);
}

function SituacaoFinanceiraChip({ situacao, meses, valor }: {
  situacao: SituacaoFinanceira;
  meses?: number;
  valor?: number;
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
      {valor ? (
        <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{formatKz(valor)}</p>
      ) : null}
    </div>
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100
      px-2.5 py-1 text-[11px] font-medium text-slate-500">
      <Minus size={10} /> Sem registo
    </span>
  );
}

function RowActions({
  aluno,
  onArchive,
  onView,
  onPagamento,
}: {
  aluno: Aluno;
  onArchive: (a: Aluno) => void;
  onView: (a: Aluno) => void;
  onPagamento: (a: Aluno) => void;
}) {
  const isLead = aluno.origem === "candidatura";
  const matriculaHref =
    isLead && aluno.candidatura_id
      ? `/secretaria/admissoes/nova?candidaturaId=${aluno.candidatura_id}`
      : !isLead
        ? `/secretaria/admissoes/nova?alunoId=${aluno.id}`
        : null;

  return (
    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {!isLead && (
        <button
          type="button"
          onClick={() => onView(aluno)}
          title="Ver perfil"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors"
        >
          <Eye size={12} />
        </button>
      )}

      {!isLead && (
        <Link
          href={`/secretaria/alunos/${aluno.id}/editar`}
          title="Editar"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
        >
          <Pencil size={12} />
        </Link>
      )}

      {matriculaHref && (aluno.status || "").toLowerCase() !== "ativo" && (
        <Link
          href={matriculaHref}
          title="Abrir matrícula"
          className="flex items-center gap-1.5 rounded-lg border border-[#E3B23C]/40 px-2 py-1.5 text-xs font-bold text-[#9a7010] bg-[#E3B23C]/5 hover:bg-[#E3B23C]/10 transition-colors"
        >
          <FileCheck size={12} />
          <span>Matricular</span>
        </Link>
      )}

      {!isLead && (aluno.status || "").toLowerCase() === "ativo" && (
        <button
          type="button"
          onClick={() => onPagamento(aluno)}
          title="Registar pagamento"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-[#E3B23C] hover:text-[#9a7010] transition-colors"
        >
          <DollarSign size={12} />
        </button>
      )}

      {!isLead && (
        <button
          onClick={() => onArchive(aluno)}
          title="Arquivar"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600 transition-colors"
        >
          <Archive size={12} />
        </button>
      )}
    </div>
  );
}

function ProfileDrawer({
  aluno,
  onClose,
  onPagamento,
}: {
  aluno: Aluno | null;
  onClose: () => void;
  onPagamento: (aluno: Aluno) => void;
}) {
  const [data, setData] = useState<AlunoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aluno) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/alunos/${aluno.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar perfil.");
        setData(json.item ?? null);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
    return () => controller.abort();
  }, [aluno]);

  useEffect(() => {
    if (!aluno) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aluno, onClose]);

  const detail = data;
  const displayName = detail?.nome ?? aluno?.nome ?? "—";
  const displayStatus = detail?.status ?? aluno?.status ?? null;
  const turmaNome = detail?.turma_nome ?? null;
  const turmaCurso = detail?.turma_curso ?? null;
  const turmaId = detail?.turma_id ?? null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity
          ${aluno ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl
        border-l border-slate-200 flex flex-col transition-transform duration-300
        ${aluno ? "translate-x-0" : "translate-x-full"}`}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <p className="text-sm font-black text-slate-900">Perfil do aluno</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">
              {displayName}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> A carregar perfil…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Estado</p>
                    <p className="text-sm font-bold text-slate-700 mt-1">
                      {displayName}
                    </p>
                  </div>
                  <StatusBadge status={displayStatus} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Académico</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Turma</p>
                    <p className="font-semibold text-slate-700 mt-1">{turmaNome ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Curso</p>
                    <p className="font-semibold text-slate-700 mt-1">{turmaCurso ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contacto</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Email</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Telefone</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.telefone ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Responsável</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Nome</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.responsavel ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Telefone</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.telefone_responsavel ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Relação</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.encarregado_relacao ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Documentos</p>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">BI</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.bi_numero ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Data de nascimento</p>
                    <p className="font-semibold text-slate-700 mt-1">
                      {detail?.data_nascimento
                        ? new Date(detail.data_nascimento).toLocaleDateString("pt-AO")
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Sexo</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.sexo ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Naturalidade</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.naturalidade ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-[11px] text-slate-400 font-semibold">Província</p>
                    <p className="font-semibold text-slate-700 mt-1">{detail?.provincia ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/secretaria/alunos/${detail?.id ?? aluno?.id ?? ""}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Perfil completo
                  </Link>
                  <Link
                    href={`/secretaria/alunos/${detail?.id ?? aluno?.id ?? ""}/editar`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Editar
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => (aluno ? onPagamento(aluno) : null)}
                    disabled={!aluno || (aluno.status || "").toLowerCase() !== "ativo"}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Registar pagamento
                  </button>
                  {turmaId ? (
                    <Link
                      href={`/secretaria/turmas/${turmaId}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Ver turma
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-300">
                      Sem turma
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PagamentoDrawer({ aluno, onClose, onSuccess }: {
  aluno: Aluno | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagamento>("numerario");
  const [ref, setRef] = useState("");
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aluno, onClose]);

  const metodos: Array<{ id: MetodoPagamento; label: string; icon: React.ReactNode }> = [
    { id: "numerario", label: "Numerário", icon: <Banknote size={14} /> },
    { id: "transferencia", label: "Transferência", icon: <ArrowUpDown size={14} /> },
    { id: "multicaixa", label: "Multicaixa", icon: <CreditCard size={14} /> },
    { id: "referencia", label: "Referência", icon: <Smartphone size={14} /> },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!aluno || !valor || Number(valor) <= 0) return;
    setLoading(true);
    try {
      const idempotencyKey = `pag-${aluno.id}-${Date.now()}`;
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/pagamento-rapido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          valor: Number(valor),
          metodo_pagamento: metodo,
          referencia: ref || null,
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

  const situacao = aluno?.situacao_financeira ?? "sem_registo";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity
          ${aluno ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl
        border-l border-slate-200 flex flex-col transition-transform duration-300
        ${aluno ? "translate-x-0" : "translate-x-full"}`}>

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

        {aluno && (
          <div className={`mx-5 mt-5 rounded-xl px-4 py-3
            ${situacao === "em_atraso"
              ? "bg-rose-50 border border-rose-200"
              : "bg-slate-50 border border-slate-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Situação actual
            </p>
            <div className="flex items-center justify-between">
              <SituacaoFinanceiraChip
                situacao={situacao}
                meses={aluno.meses_atraso}
                valor={aluno.valor_em_divida}
              />
              {aluno.valor_em_divida ? (
                <span className="text-sm font-black text-rose-700">
                  {formatKz(aluno.valor_em_divida)}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
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
                onChange={(event) => setValor(event.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200
                  text-base font-bold focus:outline-none focus:ring-2
                  focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Método de pagamento</label>
            <div className="grid grid-cols-2 gap-3">
              {metodos.map((item) => {
                const active = metodo === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMetodo(item.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors
                      ${active
                        ? "border-[#1F6B3B] bg-[#1F6B3B]/10 text-[#1F6B3B]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Referência</label>
            <input
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-5 py-3 text-sm font-bold text-white hover:bg-[#185830] transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Confirmar pagamento
          </button>
        </form>
      </div>
    </>
  );
}

function ArchiveModal({
  aluno,
  onClose,
  onSuccess,
}: {
  aluno: Aluno;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Motivo obrigatório.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretaria/alunos/${aluno.id}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao arquivar.");
      onSuccess(`${aluno.nome} arquivado.`);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Arquivar aluno</h3>
            <p className="text-sm text-slate-500 mt-1">
              Confirma arquivar <span className="font-bold text-slate-700">{aluno.nome}</span>?
              O histórico financeiro e académico é preservado.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Ex.: transferência, desistência, duplicado…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B] resize-none"
          />
          {error && (
            <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkArchiveModal({
  count,
  onClose,
  onSubmit,
  loading,
}: {
  count: number;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Motivo obrigatório.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Arquivar alunos</h3>
            <p className="text-sm text-slate-500 mt-1">
              Confirma arquivar <span className="font-bold text-slate-700">{count}</span> aluno(s)?
              O histórico financeiro e académico é preservado.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            ref={textareaRef}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Ex.: transferência, desistência, duplicado…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B] resize-none"
          />
          {error && (
            <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

type ToastState = { type: "success" | "error"; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.type === "success" ? 3500 : 0);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl animate-in slide-in-from-bottom-2 duration-200 ${
        toast.type === "success" ? "bg-[#1F6B3B]" : "bg-rose-600"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle2 size={15} className="text-white flex-shrink-0" />
      ) : (
        <AlertCircle size={15} className="text-white flex-shrink-0" />
      )}
      <p className="text-sm font-semibold text-white">{toast.message}</p>
      {toast.type === "error" && (
        <button onClick={onDismiss} className="text-white/70 hover:text-white ml-1">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function OfflineBanner({ fromCache, updatedAt }: { fromCache: boolean; updatedAt: string | null }) {
  if (!fromCache) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <AlertCircle size={14} className="flex-shrink-0 text-amber-500" />
      <span className="font-semibold">Sem ligação</span>
      <span className="text-amber-600">
        — a mostrar dados em cache
        {updatedAt ? ` de ${new Date(updatedAt).toLocaleTimeString("pt-AO")}` : "."}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-50">
      {[20, 200, 160, 140, 80, 100].map((width, index) => (
        <td key={index} className="px-5 py-4">
          <div className="h-4 rounded-lg bg-slate-100" style={{ width }} />
        </td>
      ))}
    </tr>
  );
}

const TAB_TO_STATUS: Record<TabStatus, string> = {
  leads: "pendente",
  ativos: "ativo",
  inativos: "inativo",
  arquivados: "arquivado",
};

export default function AlunosSecretariaPage({ escolaId }: { escolaId?: string | null }) {
  const [tab, setTab] = useState<TabStatus>("ativos");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [page, setPage] = useState(1);
  const pageCursors = useRef<Array<Cursor | null>>([null]);
  const PAGE_SIZE = 20;

  const [filters, setFilters] = useState<Filters>({ ano: "", turmaId: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);
  const [turmasError, setTurmasError] = useState<string | null>(null);

  const [items, setItems] = useState<Aluno[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta>({
    fromCache: false,
    updatedAt: null,
  });

  const [archiveTarget, setArchiveTarget] = useState<Aluno | null>(null);
  const [profileTarget, setProfileTarget] = useState<Aluno | null>(null);
  const [drawerAluno, setDrawerAluno] = useState<Aluno | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkArchiveLoading, setBulkArchiveLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [tabCounts, setTabCounts] = useState<Partial<Record<TabStatus, number>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(
    async (currentPage: number, currentTab: TabStatus, currentQ: string, currentFilters: Filters) => {
    setLoading(true);
    setFetchError(null);

    try {
      const cursor = pageCursors.current[currentPage - 1] ?? null;
      const params = new URLSearchParams({
        q: currentQ,
        status: TAB_TO_STATUS[currentTab],
        pageSize: String(PAGE_SIZE),
      });
      if (escolaId) {
        params.set("escolaId", escolaId);
      }
      if (currentFilters.ano) {
        params.set("ano", currentFilters.ano);
      }
      if (currentFilters.turmaId) {
        params.set("turma_id", currentFilters.turmaId);
      }
      if (cursor) {
        params.set("cursor_created_at", cursor.created_at);
        params.set("cursor_id", cursor.id);
      } else {
        params.set("page", String(currentPage));
      }

      const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, { cache: "no-store" });
      const json: ApiResponse = await res.json().catch(() => ({ ok: false, items: [] }));

      if (!json.ok) throw new Error(json.error || "Falha ao carregar.");

      setItems(json.items ?? []);
      const totalCount = json.total ?? json.items?.length ?? 0;
      setTotal(totalCount);
      setTabCounts((prev) => ({ ...prev, [currentTab]: totalCount }));
      setOfflineMeta({ fromCache: false, updatedAt: null });

      const more = Boolean(json.page?.hasMore);
      const nextCursor = json.page?.nextCursor ?? null;
      setHasMore(more);
      pageCursors.current[currentPage] = nextCursor;
    } catch (err: any) {
      setFetchError(err.message || "Erro inesperado.");
      setItems([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    pageCursors.current = [null];
    setSelected(new Set());
    load(1, tab, debouncedQ, filters);
  }, [tab, debouncedQ, filters, load]);

  useEffect(() => {
    if (page !== 1) {
      setSelected(new Set());
      load(page, tab, debouncedQ, filters);
    }
  }, [page, tab, debouncedQ, filters, load]);

  const loadTurmas = useCallback(async () => {
    if (turmasLoading || turmas.length > 0) return;
    setTurmasLoading(true);
    setTurmasError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (escolaId) params.set("escolaId", escolaId);
      const res = await fetch(`/api/secretaria/turmas?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({ ok: false, items: [] }));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar turmas.");
      const items = (json.items || []).map((row: any) => ({
        id: row.id,
        nome: row.nome || row.turma_nome || "Sem nome",
        ano_letivo: row.ano_letivo ?? null,
      }));
      setTurmas(items);
    } catch (err: any) {
      setTurmasError(err.message || "Erro ao carregar turmas.");
    } finally {
      setTurmasLoading(false);
    }
  }, [turmasLoading, turmas.length]);

  useEffect(() => {
    if (showFilters) {
      loadTurmas();
    }
  }, [showFilters, loadTurmas]);

  const handleTabChange = (nextTab: TabStatus) => {
    setTab(nextTab);
    setQ("");
  };

  const handleArchiveSuccess = (message: string) => {
    setToast({ type: "success", message });
    setPage(1);
    pageCursors.current = [null];
    load(1, tab, debouncedQ, filters);
  };

  const handlePagamentoSuccess = (message: string) => {
    setToast({ type: "success", message });
    load(page, tab, debouncedQ, filters);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const allSelected = items.length > 0 && items.every((item) => prev.has(item.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(items.map((item) => item.id));
    });
  };

  const exportCsv = (rows: Aluno[], filename: string) => {
    if (rows.length === 0) return;
    const headers = [
      "nome",
      "email",
      "responsavel",
      "telefone_responsavel",
      "status",
      "numero_login",
      "numero_processo",
      "origem",
      "created_at",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [headers.join(",")].concat(
      rows.map((row) =>
        headers
          .map((key) => {
            const value = (row as Record<string, unknown>)[key];
            return escape(value === null || value === undefined ? "" : String(value));
          })
          .join(",")
      )
    );
    const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (mode: "page" | "all") => {
    const params = new URLSearchParams({
      q: debouncedQ,
      status: TAB_TO_STATUS[tab],
      pageSize: String(PAGE_SIZE),
    });
    if (escolaId) params.set("escolaId", escolaId);
    if (filters.ano) params.set("ano", filters.ano);
    if (filters.turmaId) params.set("turma_id", filters.turmaId);
    if (mode === "page") {
      params.set("page", String(page));
    } else {
      params.set("all", "1");
    }
    setShowExport(false);
    window.open(`/api/secretaria/alunos/exportar?${params.toString()}`, "_blank");
  };

  const handleBulkArchive = async (reason: string) => {
    if (selected.size === 0) return;
    setBulkArchiveLoading(true);
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map(async (id) => {
        const params = new URLSearchParams();
        if (escolaId) params.set("escolaId", escolaId);
        const res = await fetch(
          `/api/secretaria/alunos/${id}/delete${params.toString() ? `?${params.toString()}` : ""}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          }
        );
        const json = await res.json().catch(() => ({}));
        return res.ok && json.ok;
      })
    );
    const successCount = results.filter(Boolean).length;
    const failureCount = ids.length - successCount;
    if (successCount > 0) {
      setToast({ type: "success", message: `${successCount} aluno(s) arquivado(s).` });
    }
    if (failureCount > 0) {
      setToast({ type: "error", message: `${failureCount} falha(s) ao arquivar.` });
    }
    setBulkArchiveOpen(false);
    setBulkArchiveLoading(false);
    setSelected(new Set());
    setPage(1);
    pageCursors.current = [null];
    load(1, tab, debouncedQ, filters);
  };

  const activeFilters = Number(Boolean(filters.ano)) + Number(Boolean(filters.turmaId));
  const yearOptions = [
    new Date().getFullYear() + 1,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
  ];

  const initials = (nome: string) =>
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

  return (
    <>
      {archiveTarget && (
        <ArchiveModal
          aluno={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onSuccess={handleArchiveSuccess}
        />
      )}
      {bulkArchiveOpen && (
        <BulkArchiveModal
          count={selected.size}
          onClose={() => setBulkArchiveOpen(false)}
          onSubmit={handleBulkArchive}
          loading={bulkArchiveLoading}
        />
      )}

      <ProfileDrawer
        aluno={profileTarget}
        onClose={() => setProfileTarget(null)}
        onPagamento={(aluno) => {
          setProfileTarget(null);
          setDrawerAluno(aluno);
        }}
      />

      <PagamentoDrawer
        aluno={drawerAluno}
        onClose={() => setDrawerAluno(null)}
        onSuccess={handlePagamentoSuccess}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Breadcrumb
          items={[
            { label: "Secretaria", href: "/secretaria" },
            { label: "Alunos" },
          ]}
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1F6B3B] tracking-tight">Gestão de Alunos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Leads, matrículas e histórico — num único lugar.
            </p>
          </div>

          <Link
            href="/secretaria/admissoes/nova"
            className="flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#185830] transition-colors shadow-sm flex-shrink-0"
          >
            <Plus size={14} />
            Nova Admissão
          </Link>
        </div>

        <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />

        {fetchError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Erro: </span>
              {fetchError}
            </div>
            <button
              onClick={() => load(1, tab, debouncedQ, filters)}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors flex-shrink-0"
            >
              <RefreshCw size={11} /> Repetir
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 pt-4">
            <TabBar active={tab} counts={tabCounts} onChange={handleTabChange} />
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Nome, número de login, processo…"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  activeFilters > 0
                    ? "border-[#1F6B3B] bg-[#1F6B3B]/5 text-[#1F6B3B]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal size={12} /> Filtros
                {activeFilters > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1F6B3B] text-[9px] font-black text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-4 z-20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filtros</p>
                    <button
                      onClick={() => setFilters({ ano: "", turmaId: "" })}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Ano letivo</label>
                      <select
                        value={filters.ano}
                        onChange={(event) => setFilters((prev) => ({ ...prev, ano: event.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                      >
                        <option value="">Todos</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Turma</label>
                      <select
                        value={filters.turmaId}
                        onChange={(event) => setFilters((prev) => ({ ...prev, turmaId: event.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/30 focus:border-[#1F6B3B]"
                      >
                        <option value="">Todas</option>
                        {turmas.map((turma) => (
                          <option key={turma.id} value={turma.id}>
                            {turma.nome}
                          </option>
                        ))}
                      </select>
                      {turmasLoading && (
                        <p className="text-[11px] text-slate-400 mt-1">A carregar turmas…</p>
                      )}
                      {turmasError && (
                        <p className="text-[11px] text-rose-500 mt-1">{turmasError}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!loading && (
                <span className="text-xs text-slate-400 font-semibold">
                  {total}
                  {hasMore ? "+" : ""} {total === 1 ? "registo" : "registos"}
                </span>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowExport((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Exportar CSV"
                >
                  <Download size={12} /> Exportar
                </button>
                {showExport && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white shadow-xl p-2 z-20">
                    <button
                      onClick={() => handleExport("page")}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Página atual
                    </button>
                    <button
                      onClick={() => handleExport("all")}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Tudo
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setPage(1);
                  pageCursors.current = [null];
                  load(1, tab, debouncedQ, filters);
                }}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 transition-colors"
                title="Actualizar"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((item) => selected.has(item.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B]/30"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  {["Aluno", "Contacto", "Responsável", "Estado", "Acções"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${
                        index === 3 ? "text-center" : index === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => <SkeletonRow key={index} />)
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={28} className="text-slate-200" />
                        <p className="text-sm font-semibold text-slate-400">
                          Nenhum registo encontrado.
                        </p>
                        {q && (
                          <button
                            onClick={() => setQ("")}
                            className="mt-1 text-xs text-[#1F6B3B] font-semibold hover:underline"
                          >
                            Limpar pesquisa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((aluno) => {
                    const isLead = aluno.origem === "candidatura";
                    const id = aluno.numero_processo
                      ? `Proc. ${aluno.numero_processo}`
                      : aluno.numero_login
                        ? `Login ${aluno.numero_login}`
                        : null;

                    return (
                      <tr key={aluno.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={selected.has(aluno.id)}
                            onChange={() => toggleSelect(aluno.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#1F6B3B] focus:ring-[#1F6B3B]/30"
                            aria-label={`Selecionar ${aluno.nome}`}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-[#1F6B3B]/10 flex items-center justify-center flex-shrink-0 text-xs font-black text-[#1F6B3B]">
                              {initials(aluno.nome || "?")}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{aluno.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {id && <span className="font-mono text-[10px] text-slate-400">{id}</span>}
                                {isLead && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 uppercase tracking-wide">
                                    Lead
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {aluno.email ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Mail size={11} className="text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[160px]">{aluno.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          {aluno.responsavel ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">
                                {aluno.responsavel}
                              </p>
                              {aluno.telefone_responsavel && (
                                <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                  <Phone size={10} />
                                  {aluno.telefone_responsavel}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge status={aluno.status} />
                        </td>

                        <td className="px-5 py-3.5">
                          <RowActions
                            aluno={aluno}
                            onArchive={setArchiveTarget}
                            onView={setProfileTarget}
                            onPagamento={setDrawerAluno}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/30">
            <span className="text-xs text-slate-400 font-semibold">Página {page}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => prev - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} /> Anterior
              </button>
              <button
                disabled={!hasMore || loading}
                onClick={() => setPage((prev) => prev + 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Seguinte <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 shadow-2xl shadow-black/30 animate-in slide-in-from-bottom-3 duration-200 border border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E3B23C] text-xs font-black text-slate-900">
              {selected.size}
            </div>
            <span className="text-sm font-semibold text-white">
              {selected.size === 1 ? "aluno seleccionado" : "alunos seleccionados"}
            </span>
            <span className="text-slate-600 text-xs">de {items.length}</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(items.filter((item) => selected.has(item.id)), `alunos-selecionados-${Date.now()}.csv`)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              <Download size={12} /> Exportar
            </button>
            <button
              onClick={() => setBulkArchiveOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-rose-400 hover:text-rose-200 transition-colors"
            >
              <Archive size={12} /> Arquivar
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              <X size={12} /> Limpar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
