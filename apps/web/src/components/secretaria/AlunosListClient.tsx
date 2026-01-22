// apps/web/src/components/secretaria/AlunosListClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  Users,
  Mail,
  Phone,
  Shield,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";

/**
 * KLASSE UI notes:
 * - Gold (#E3B23C) = action/active states
 * - Green (#1F6B3B) = brand/headings
 * - Radius: rounded-xl (cards/inputs/buttons), rounded-full (badges)
 * - Focus: ring-4 ring-klasse-gold/20 + border-klasse-gold
 */

// -----------------------------
// Types
// -----------------------------
type Aluno = {
  id: string;
  nome: string;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  status?: string | null;
  created_at: string;

  // Identifiers
  numero_login?: string | null; // existe quando virou aluno/matricula
  numero_processo?: string | null; // pode existir se vocês mantiveram "processo" em alunos

  // Lead/origem
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

// -----------------------------
// Small utilities
// -----------------------------
function useDebounce<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type OfflineMeta = { fromCache: boolean; updatedAt: string | null };

// -----------------------------
// UI micro-components
// -----------------------------
function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-black text-slate-950 mt-1">{value}</p>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const st = (status || "pendente").toLowerCase();

  // Ajusta conforme teus status reais do backend
  const styles: Record<string, string> = {
    ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
    matriculado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pendente: "bg-amber-50 text-amber-800 border-amber-200",
    submetida: "bg-amber-50 text-amber-800 border-amber-200",
    em_analise: "bg-sky-50 text-sky-700 border-sky-200",
    aprovada: "bg-indigo-50 text-indigo-700 border-indigo-200",
    suspenso: "bg-amber-50 text-amber-800 border-amber-200",
    inativo: "bg-rose-50 text-rose-700 border-rose-200",
    arquivado: "bg-slate-100 text-slate-600 border-slate-200",
    todos: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize",
        styles[st] || styles.pendente,
      ].join(" ")}
      title={st}
    >
      {st.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
    </div>
  );
}

// -----------------------------
// Main
// -----------------------------
export default function AlunosListClient() {
  const router = useRouter();

  // Filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  // Mantive teus filtros (porque não tenho certeza do teu endpoint /api/secretaria/alunos).
  // Se teu backend mudou para status de candidatura (submetida/em_analise/aprovada/matriculado),
  // você só troca a lista abaixo + o "default".
  const [status, setStatus] = useState<"pendente" | "ativo" | "inativo" | "arquivado" | "todos">("pendente");

  // Paging/cursor
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data
  const [items, setItems] = useState<Aluno[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageCursors = useRef<Array<Cursor | null>>([null]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta>({
    fromCache: false,
    updatedAt: null,
  });

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);

  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 76,
    overscan: 6,
  });

  const hasRows = !loading && items.length > 0;

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);

      try {
        const cursor = pageCursors.current[p - 1] ?? null;

        const params = new URLSearchParams({
          q: debouncedQ,
          status,
          pageSize: String(pageSize),
        });

        if (cursor) {
          params.set("cursor_created_at", cursor.created_at);
          params.set("cursor_id", cursor.id);
        } else {
          params.set("page", String(p));
        }

        const cacheKey = `secretaria:alunos:${params.toString()}`;
        const { data: json, fromCache, updatedAt } = await fetchJsonWithOffline<ApiResponse>(
          `/api/secretaria/alunos?${params.toString()}`,
          undefined,
          cacheKey
        );

        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar.");

        setItems(json.items || []);
        setTotal(json.total ?? json.items?.length ?? 0);
        setOfflineMeta({ fromCache, updatedAt });

        const more = Boolean(json.page?.hasMore);
        setHasMore(more);

        const nextCursor = json.page?.nextCursor ?? null;
        pageCursors.current[p] = nextCursor;
      } catch (e: any) {
        setError(e.message || "Erro inesperado.");
        setItems([]);
        setTotal(0);
        setHasMore(false);
        setOfflineMeta({ fromCache: false, updatedAt: null });
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, pageSize, status]
  );

  // Reload triggers
  useEffect(() => {
    setPage(1);
    pageCursors.current = [null];
    load(1);
  }, [debouncedQ, status, load]);

  useEffect(() => {
    if (page !== 1) {
      load(page);
    }
  }, [page, load]);

  // Actions
  const handleOpenDelete = (aluno: Aluno) => {
    setAlunoSelecionado(aluno);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!alunoSelecionado) return;
    const reason = deleteReason.trim();
    if (!reason) {
      alert("Motivo obrigatório.");
      return;
    }

    setDeleting(true);
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(
        `/api/secretaria/alunos/${alunoSelecionado.id}/delete`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );

      if (!json.ok) throw new Error(json.error || "Falha ao arquivar.");

      await load(1);
      setShowDeleteModal(false);
    } catch (e: any) {
      alert(e.message || "Erro ao arquivar.");
    } finally {
      setDeleting(false);
    }
  };

  // Derived stats (só na página atual; se quiser global, precisa endpoint)
  const stats = useMemo(() => {
    const pendentes = items.filter((a) => (a.status || "").toLowerCase() === "pendente").length;
    const ativos = items.filter((a) => (a.status || "").toLowerCase() === "ativo").length;
    const comEmail = items.filter((a) => !!a.email).length;
    const comResp = items.filter((a) => !!a.responsavel).length;
    return { pendentes, ativos, comEmail, comResp };
  }, [items]);

  // Filter options
  const statusOptions: Array<{ label: string; value: typeof status }> = [
    { label: "Leads (pendente)", value: "pendente" },
    { label: "Matriculados (ativo)", value: "ativo" },
    { label: "Inativos", value: "inativo" },
    { label: "Arquivados", value: "arquivado" },
    { label: "Todos", value: "todos" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-2"
          >
            <ArrowLeft size={16} className="text-slate-400" />
            Voltar
          </button>

          <h1 className="text-2xl font-black text-klasse-green tracking-tight">Gestão de Alunos</h1>
          <p className="text-sm text-slate-600 mt-1">
            Leads (candidaturas) podem aparecer como <span className="font-semibold">pendentes</span> até a conversão para matrícula.
          </p>
        </div>

        <Link
          href="/secretaria/admissoes/nova"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-klasse-gold text-white hover:brightness-95 shadow-sm"
        >
          <Plus size={16} />
          Nova Admissão
        </Link>
      </div>

      <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />

      {/* Error */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <div className="font-bold">Erro ao carregar</div>
          <div className="mt-1">{error}</div>
          <button
            onClick={() => load(1)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total (página)" value={total} icon={Users} />
        <KpiCard title="Leads pendentes" value={stats.pendentes} icon={Filter} />
        <KpiCard title="Ativos" value={stats.ativos} icon={Shield} />
        <KpiCard title="Com responsável" value={stats.comResp} icon={Users} />
      </div>

      {/* Table card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, responsável, processo ou login…"
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none
                           focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
              />
            </div>

            <div className="flex gap-2 w-full lg:w-auto overflow-x-auto">
              {statusOptions.map((s) => {
                const active = status === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={[
                      "whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                      active
                        ? "bg-white border-klasse-gold text-klasse-gold ring-1 ring-klasse-gold/25"
                        : "bg-white border-slate-200 text-slate-600 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-white sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>

              <tbody
                className="bg-white divide-y divide-slate-100"
                style={
                  hasRows
                    ? { position: "relative", display: "block", height: rowVirtualizer.getTotalSize() }
                    : undefined
                }
              >
                {loading ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={5} className="p-12 text-center text-slate-600">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-klasse-gold" />
                      Carregando…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={5}>
                      <EmptyState
                        title="Nenhum registro encontrado."
                        subtitle="Tente outro termo de busca ou ajuste o filtro."
                      />
                    </td>
                  </tr>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const aluno = items[virtualRow.index];

                    const isLead = aluno.origem === "candidatura";
                    const identificador =
                      aluno.numero_processo || aluno.numero_login || "—";
                    const identificadorLabel = aluno.numero_processo
                      ? "Proc."
                      : aluno.numero_login
                        ? "Login"
                        : "—";

                    const matriculaHref =
                      isLead && aluno.candidatura_id
                        ? `/secretaria/admissoes/nova?candidaturaId=${aluno.candidatura_id}`
                        : !isLead
                          ? `/secretaria/admissoes/nova?alunoId=${aluno.id}`
                          : null;

                    const initials = (aluno.nome || "—")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")
                      .slice(0, 2);

                    return (
                      <tr
                        key={aluno.id}
                        className="hover:bg-slate-50 transition-colors group"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          width: "100%",
                          display: "table",
                          tableLayout: "fixed",
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                              <span className="text-xs font-black text-slate-600">{initials || "—"}</span>
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-950 truncate">{aluno.nome}</p>

                              <p className="text-xs text-slate-500 font-mono mt-0.5">
                                {identificadorLabel !== "—" ? `${identificadorLabel}: ${identificador}` : "—"}
                              </p>

                              {isLead ? (
                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 uppercase">
                                  Lead
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {aluno.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="truncate">{aluno.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {aluno.responsavel ? (
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{aluno.responsavel}</p>
                              {aluno.telefone_responsavel ? (
                                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <Phone className="w-4 h-4 text-slate-400" />
                                  {aluno.telefone_responsavel}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={aluno.status} />
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {/* Matricular (se não ativo ainda) */}
                            {matriculaHref && (aluno.status || "").toLowerCase() !== "ativo" ? (
                              <Link
                                href={matriculaHref}
                                className="p-2 rounded-xl text-slate-400 hover:text-klasse-gold hover:bg-amber-50 transition"
                                title="Abrir matrícula"
                              >
                                <Plus className="w-4 h-4" />
                              </Link>
                            ) : null}

                            {/* Ações só para aluno (não lead) */}
                            {!isLead ? (
                              <>
                                <Link
                                  href={`/secretaria/alunos/${aluno.id}`}
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                  title="Ver"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>

                                <Link
                                  href={`/secretaria/alunos/${aluno.id}/editar`}
                                  className="p-2 rounded-xl text-slate-400 hover:text-klasse-gold hover:bg-amber-50 transition"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>

                                <button
                                  onClick={() => handleOpenDelete(aluno)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Arquivar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
          <span className="font-semibold">Página {page}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>

      {/* Delete / Archive modal */}
      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-black text-slate-950">Arquivar aluno</h3>
            <p className="text-sm text-slate-600 mt-2">
              Confirma arquivar <span className="font-bold">{alunoSelecionado?.nome}</span>? Isso não apaga histórico financeiro.
            </p>

            <div className="mt-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Motivo (obrigatório)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ex.: desistiu / transferência / duplicado…"
                rows={3}
                className="mt-2 w-full p-3 border border-slate-200 rounded-xl text-sm outline-none
                           focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:brightness-95 disabled:opacity-60"
              >
                {deleting ? "Arquivando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
