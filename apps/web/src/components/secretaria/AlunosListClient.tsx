// apps/web/src/components/secretaria/AlunosListClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StatusPill as StatusBadge } from "@/components/ui/StatusPill";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import {
  Loader2,
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
import { OperationalCursorPagination, OperationalTableEmptyState, OperationalTableErrorState, OperationalTableFilterBar } from "@/components/ui/OperationalTableStates";

/**
 * KLASSE UI notes:
 * - klasse-gold = action/active states
 * - klasse-green = brand/headings
 * - Radius: rounded-xl (cards/inputs/buttons), rounded-full (badges)
 * - Focus: ring-4 ring-amber/20 + border-amber
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
  numero_processo_login?: string | null; // login oficial do aluno
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

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status === 401
        ? "Não autenticado. Faça login novamente."
        : res.status === 403
          ? "Sem permissão para acessar este recurso."
          : "Falha na requisição.");
    throw new Error(msg);
  }
  return data as T;
}

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
    <div className="bg-card border border-border rounded-xl shadow-sm p-5 flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-black text-foreground mt-1">{value}</p>
      </div>

      <div className="p-3 rounded-xl bg-muted border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// -----------------------------
// Main
// -----------------------------
export default function AlunosListClient() {
  const router = useRouter();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const pathname = usePathname();
  const slugFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const portalBase = pathname?.includes("/operacoes")
    ? "/operacoes"
    : "/secretaria";
  const secretariaBase = slugFromPath
    ? `/escola/${slugFromPath}${portalBase}`
    : portalBase;

  // Filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [status, setStatus] = useState<"pendente" | "ativo" | "inativo" | "arquivado" | "todos">("pendente");

  // Paging/cursor
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data
  const [items, setItems] = useState<Aluno[]>([]);
  const [hasMore, setHasMore] = useState(false);
  // A cursor changing must never itself retrigger the list request.
  const pageCursorsRef = useRef<Array<Cursor | null>>([null]);
  const requestSequence = useRef(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 76,
    overscan: 6,
  });

  const hasRows = !loading && items.length > 0;

  const load = useCallback(async (p = 1, signal?: AbortSignal) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setFetchError(null);
    try {
      const cursor = pageCursorsRef.current[p - 1] ?? null;
      const params = new URLSearchParams({ q: debouncedQ, status, pageSize: String(pageSize) });
      if (cursor) {
        params.set("cursor_created_at", cursor.created_at);
        params.set("cursor_id", cursor.id);
      } else {
        params.set("page", String(p));
      }
      const json = await fetchJson<ApiResponse>(`/api/secretaria/alunos?${params.toString()}`, { signal });
      if (!json?.ok) throw new Error(json?.error || "Falha ao carregar.");
      if (requestId !== requestSequence.current || signal?.aborted) return;
      setItems(json.items ?? []);
      // The API's `total` is the count of the current batch, never the entire school.
      setHasMore(Boolean(json.page?.hasMore));
      pageCursorsRef.current[p] = json.page?.nextCursor ?? null;
    } catch (cause) {
      if (requestId !== requestSequence.current || signal?.aborted) return;
      setFetchError(cause instanceof Error ? cause.message : "Erro inesperado.");
      setItems([]);
      setHasMore(false);
    } finally {
      if (requestId === requestSequence.current && !signal?.aborted) setLoading(false);
    }
  }, [debouncedQ, pageSize, status]);

  useEffect(() => {
    pageCursorsRef.current = [null];
    setPage(1);
  }, [debouncedQ, status]);

  useEffect(() => {
    if (q !== debouncedQ) return;
    // A filter change resets the cursor before the old page is allowed to load.
    if (page > 1 && pageCursorsRef.current.length === 1) return;
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [page, load, q, debouncedQ]);

  // Actions
  const handleArchive = async (aluno: Aluno) => {
    const reason = await confirm({
      title: "Arquivar processo",
      message: `Deseja mover o processo de ${aluno.nome} para o arquivo? Por favor, indique o motivo para consulta futura.`,
      inputType: "text",
      placeholder: "Ex: desistiu / transferência / duplicado...",
      confirmLabel: "Arquivar definitivamente",
      variant: "danger",
    });

    if (!reason || reason.trim().length < 3) {
      if (reason !== null) {
        error("Motivo necessário", "Por favor, indique um motivo válido com pelo menos 3 caracteres.");
      }
      return;
    }

    setDeleting(true);
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(
        `/api/secretaria/alunos/${aluno.id}/delete`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );

      if (!json.ok) throw new Error(json.error || "Falha ao arquivar.");

      success("Processo arquivado", "O processo do aluno foi movido para o arquivo com sucesso.");
      pageCursorsRef.current = [null];
      setPage(1);
      await load(1);
    } catch {
      error("Não foi possível arquivar", "Houve um erro técnico ao tentar arquivar o processo deste aluno. Por favor, tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  // Derived stats
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
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={16} className="text-muted-foreground" />
            Voltar
          </button>

          <h1 className="text-2xl font-black text-emerald tracking-tight">Gestão de Alunos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leads (candidaturas) podem aparecer como <span className="font-semibold">pendentes</span> até a conversão para matrícula.
          </p>
        </div>

        <Link
          href={`${secretariaBase}/matriculas/nova`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber text-white hover:brightness-95 shadow-sm"
        >
          <Plus size={16} />
          Nova Admissão
        </Link>
      </div>

      {fetchError && <OperationalTableErrorState description={fetchError} onRetry={() => void load(page)} />}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Registos nesta página" value={items.length} icon={Users} />
        <KpiCard title="Leads pendentes" value={stats.pendentes} icon={Filter} />
        <KpiCard title="Ativos" value={stats.ativos} icon={Shield} />
        <KpiCard title="Com responsável" value={stats.comResp} icon={Users} />
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Filters share one accessible surface; neither URL nor API query semantics change. */}
        <div className="border-b border-border p-3 sm:p-4">
          <OperationalTableFilterBar
            label="Pesquisar alunos"
            query={q}
            onQueryChange={setQ}
            placeholder="Pesquisar por nome, responsável, processo ou login…"
            activeFilters={Number(status !== "pendente") + Number(Boolean(q.trim()))}
            onClearFilters={() => { setQ(""); setStatus("pendente"); setPage(1); pageCursorsRef.current = [null]; }}
          >
            <div role="group" aria-label="Filtrar alunos por estado" className="flex min-w-0 flex-wrap items-center gap-2">
              {statusOptions.map((option) => {
                const active = status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setStatus(option.value); setPage(1); pageCursorsRef.current = [null]; }}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${active ? "border-klasse-gold/50 bg-klasse-gold/10 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </OperationalTableFilterBar>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
            <table className="min-w-full table-fixed divide-y divide-border">
              <thead className="bg-card sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Aluno</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Responsável</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>

              <tbody
                className="bg-card divide-y divide-border"
                style={
                  hasRows
                    ? { position: "relative", display: "block", height: rowVirtualizer.getTotalSize() }
                    : undefined
                }
              >
                {loading ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber" />
                      Carregando…
                    </td>
                  </tr>
                ) : fetchError ? null : items.length === 0 ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={5}>
                      <OperationalTableEmptyState
                        title="Nenhum registo encontrado"
                        description={q.trim() || status !== "todos" ? "Ajuste a pesquisa ou selecione outro estado." : "Ainda não há alunos registados."}
                      />
                    </td>
                  </tr>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const aluno = items[virtualRow.index];

                    const isLead = aluno.origem === "candidatura";
                    const identificador =
                      aluno.numero_processo_login || aluno.numero_processo || "—";
                    const identificadorLabel = aluno.numero_processo
                      ? "Proc."
                      : aluno.numero_processo_login
                        ? "Login"
                        : "—";

                    const matriculaHref =
                      isLead && aluno.candidatura_id
                        ? `${secretariaBase}/matriculas/nova?candidaturaId=${aluno.candidatura_id}`
                        : !isLead
                          ? `${secretariaBase}/matriculas/nova?alunoId=${aluno.id}`
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
                        className="hover:bg-muted transition-colors group"
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
                            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center">
                              <span className="text-xs font-black text-muted-foreground">{initials || "—"}</span>
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-sm text-foreground truncate">{aluno.nome}</p>

                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
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

                        <td className="px-6 py-4 text-sm text-foreground">
                          {aluno.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="truncate">{aluno.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-foreground">
                          {aluno.responsavel ? (
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{aluno.responsavel}</p>
                              {aluno.telefone_responsavel ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  {aluno.telefone_responsavel}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
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
                                className="p-2 rounded-xl text-muted-foreground hover:text-amber hover:bg-amber-50 transition"
                                title="Abrir matrícula"
                              >
                                <Plus className="w-4 h-4" />
                              </Link>
                            ) : null}

                            {/* Ações só para aluno (não lead) */}
                            {!isLead ? (
                              <>
                                <Link
                                  href={`${secretariaBase}/alunos/${aluno.id}`}
                                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                  title="Ver"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>

                                <Link
                                  href={`${secretariaBase}/alunos/${aluno.id}/editar`}
                                  className="p-2 rounded-xl text-muted-foreground hover:text-amber hover:bg-amber-50 transition"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>

                                <button
                                  onClick={() => handleArchive(aluno)}
                                  disabled={deleting}
                                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30"
                                  title="Arquivar"
                                >
                                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

        <div className="border-t border-border bg-muted/50 p-3 sm:p-4">
          <OperationalCursorPagination
            page={page}
            visibleCount={items.length}
            hasMore={hasMore}
            disabled={loading || Boolean(fetchError)}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
