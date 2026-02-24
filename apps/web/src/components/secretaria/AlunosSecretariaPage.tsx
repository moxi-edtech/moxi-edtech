"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Users,
  ChevronRight,
  Eye,
  Pencil,
  Archive,
  UserCheck,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  RefreshCw,
  ChevronLeft,
  FileCheck,
  Slash,
  DollarSign,
} from "lucide-react";

type TabStatus = "leads" | "ativos" | "inativos" | "arquivados";

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
};

type Cursor = { created_at: string; id: string };

type ApiResponse = {
  ok: boolean;
  items: Aluno[];
  total?: number;
  page?: { hasMore?: boolean; nextCursor?: Cursor | null };
  error?: string;
};

type OfflineMeta = { fromCache: boolean; updatedAt: string | null };
type ToastState = { type: "success" | "error"; message: string } | null;

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type BreadcrumbItem = { label: string; href?: string };

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center gap-1 text-xs font-semibold text-slate-400">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <Slash size={10} className="text-slate-300" />}
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
  onChange: (t: TabStatus) => void;
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

function RowActions({ aluno, onArchive }: { aluno: Aluno; onArchive: (a: Aluno) => void }) {
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
        <Link
          href={`/secretaria/alunos/${aluno.id}`}
          title="Ver perfil"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-[#1F6B3B] hover:text-[#1F6B3B] transition-colors"
        >
          <Eye size={12} />
        </Link>
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
        <Link
          href={`/secretaria/alunos/${aluno.id}/pagamento`}
          title="Registar pagamento"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:border-[#E3B23C] hover:text-[#9a7010] transition-colors"
        >
          <DollarSign size={12} />
        </Link>
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
    setTimeout(() => textareaRef.current?.focus(), 80);
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado";
      setError(message);
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
              Confirma arquivar <span className="font-bold text-slate-700">{aluno.nome}</span>? O
              histórico financeiro e académico é preservado.
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
            onChange={(e) => {
              setReason(e.target.value);
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

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.type === "success" ? 3500 : 0);
    return () => clearTimeout(t);
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
        {updatedAt ? ` de ${new Date(updatedAt).toLocaleTimeString("pt-AO")}` : ""}.
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-50">
      {[40, 200, 160, 140, 80, 100].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 rounded-lg bg-slate-100" style={{ width: w }} />
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

export default function AlunosSecretariaPage() {
  const [tab, setTab] = useState<TabStatus>("ativos");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [page, setPage] = useState(1);
  const pageCursors = useRef<Array<Cursor | null>>([null]);
  const PAGE_SIZE = 20;

  const [items, setItems] = useState<Aluno[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta>({ fromCache: false, updatedAt: null });

  const [archiveTarget, setArchiveTarget] = useState<Aluno | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [tabCounts, setTabCounts] = useState<Partial<Record<TabStatus, number>>>({});

  const load = useCallback(async (p: number, currentTab: TabStatus, currentQ: string) => {
    setLoading(true);
    setFetchError(null);

    try {
      const cursor = pageCursors.current[p - 1] ?? null;
      const params = new URLSearchParams({
        q: currentQ,
        status: TAB_TO_STATUS[currentTab],
        pageSize: String(PAGE_SIZE),
      });
      if (cursor) {
        params.set("cursor_created_at", cursor.created_at);
        params.set("cursor_id", cursor.id);
      } else {
        params.set("page", String(p));
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
      pageCursors.current[p] = nextCursor;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro inesperado.";
      setFetchError(message);
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
    load(1, tab, debouncedQ);
  }, [tab, debouncedQ, load]);

  useEffect(() => {
    if (page !== 1) load(page, tab, debouncedQ);
  }, [page, tab, debouncedQ, load]);

  const handleTabChange = (t: TabStatus) => {
    setTab(t);
    setQ("");
  };

  const handleArchiveSuccess = (msg: string) => {
    setToast({ type: "success", message: msg });
    setPage(1);
    pageCursors.current = [null];
    load(1, tab, debouncedQ);
  };

  const initials = (nome: string) =>
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="w-full max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Breadcrumb items={[{ label: "Secretaria", href: "/secretaria" }, { label: "Alunos" }]} />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1F6B3B] tracking-tight">Gestão de Alunos</h1>
            <p className="text-sm text-slate-500 mt-1">Leads, matrículas e histórico — num único lugar.</p>
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
              onClick={() => load(1, tab, debouncedQ)}
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
                onChange={(e) => setQ(e.target.value)}
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

            <div className="ml-auto flex items-center gap-2">
              {!loading && (
                <span className="text-xs text-slate-400 font-semibold">
                  {total}
                  {hasMore ? "+" : ""} {total === 1 ? "registo" : "registos"}
                </span>
              )}

              <button
                onClick={() => {
                  setPage(1);
                  pageCursors.current = [null];
                  load(1, tab, debouncedQ);
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
                  {["Aluno", "Contacto", "Responsável", "Estado", "Acções"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${
                        i === 3 ? "text-center" : i === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={28} className="text-slate-200" />
                        <p className="text-sm font-semibold text-slate-400">Nenhum registo encontrado.</p>
                        {q && (
                          <button onClick={() => setQ("")} className="mt-1 text-xs text-[#1F6B3B] font-semibold hover:underline">
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
                              <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{aluno.responsavel}</p>
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
                          <RowActions aluno={aluno} onArchive={setArchiveTarget} />
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
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} /> Anterior
              </button>
              <button
                disabled={!hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Seguinte <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
