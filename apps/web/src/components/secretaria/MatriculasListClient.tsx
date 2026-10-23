"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Download,
  UserPlus,
  ArrowLeft,
  Users,
  BookOpen,
  RefreshCw,
  ArrowUpDown,
  FileText,
  UserCheck,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { formatTurmaDisplayName } from "@/utils/formatters";

import StatusForm from "./StatusForm";
import TransferForm from "./TransferForm";

// --- TIPOS ---
type Item = {
  id: string;
  numero_matricula?: string | null;
  numero_chamada?: number | null;
  aluno_id: string;
  turma_id: string;
  aluno_nome?: string | null;
  turma_nome?: string | null;
  sala?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
  status: string;
  data_matricula?: string | null;
  created_at: string;
};

type SessionItem = {
  id: string;
  nome?: string | null;
  status?: string | null;
  ano_letivo?: number | string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  ano_resolvido?: number | null;
};

type CursoItem = { id: string; nome?: string | null; tipo?: string | null };
type ClasseItem = { id: string; nome?: string | null; curso_id?: string | null };
type TurmaItem = {
  id: string;
  nome?: string | null;
  turma_codigo?: string | null;
  turno?: string | null;
  ano_letivo?: number | string | null;
  ano?: number | string | null;
  curso_id?: string | null;
  classe_id?: string | null;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

// --- MICRO UI (KLASSE) ---
function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  tone?: "slate" | "emerald" | "amber" | "violet";
}) {
  const tones: Record<string, { iconWrap: string; iconColor: string }> = {
    slate: { iconWrap: "bg-slate-100", iconColor: "text-slate-700" },
    emerald: { iconWrap: "bg-emerald-100/50", iconColor: "text-emerald-700" },
    amber: { iconWrap: "bg-amber-100/50", iconColor: "text-amber-700" },
    violet: { iconWrap: "bg-violet-100/50", iconColor: "text-violet-700" },
  };

  const t = tones[tone] ?? tones.slate;

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <div className={cn("rounded-xl p-3 ring-1 ring-slate-200", t.iconWrap)}>
          <Icon className={cn("h-5 w-5", t.iconColor)} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ativa: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
    pendente: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    cancelada: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
    transferida: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70",
  };

  const key = (status || "").toLowerCase();
  const style = styles[key] ?? "bg-slate-50 text-slate-700 ring-1 ring-slate-200/70";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize", style)}>
      {key === "ativa" && <CheckCircle2 className="h-3.5 w-3.5" />}
      {key === "cancelada" && <XCircle className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

function ToolbarButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      rel="noreferrer"
    >
      <Download className="h-4 w-4 text-slate-500" />
      {label}
    </a>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function MatriculasListClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const resolvedSlug = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const portalBase = pathname?.includes("/operacoes")
    ? "/operacoes"
    : "/secretaria";
  const secretariaBase = resolvedSlug
    ? `/escola/${resolvedSlug}${portalBase}`
    : portalBase;
  const novaMatriculaHref = resolvedSlug
    ? `/escola/${resolvedSlug}${portalBase}/admissoes/nova`
    : "#";

  // Filtros URL
  const turmaIdFromQuery = searchParams?.get("turma_id");
  const statusFromQuery = searchParams?.get("status");
  const statusInFromQuery = searchParams?.get("status_in");
  const statusFilters = useMemo(() => {
    if (statusInFromQuery) return statusInFromQuery.split(",").map((s) => s.trim()).filter(Boolean);
    if (statusFromQuery) return [statusFromQuery];
    return [] as string[];
  }, [statusFromQuery, statusInFromQuery]);

  // Estados Locais
  const [q, setQ] = useState("");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedAno, setSelectedAno] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Estados dos Filtros em Cascata
  const [selectedEnsino, setSelectedEnsino] = useState<string>("");
  const [cursos, setCursos] = useState<CursoItem[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<string>("");
  const [classes, setClasses] = useState<ClasseItem[]>([]);
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [showPendentes, setShowPendentes] = useState<boolean>(false);

  // Modais
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedMatricula, setSelectedMatricula] = useState<Item | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const hasRows = !loading && items.length > 0;
  const isInitialLoading = loading && items.length === 0;
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const texto = String(valor);
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const anoLetivoAtivo = useMemo(() => selectedAno ?? new Date().getFullYear(), [selectedAno]);

  // --- LÓGICA (INTACTA) ---
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/secretaria/school-sessions");
      const json = await res.json();
      if (json.ok) {
        const sessionItems = Array.isArray(json.data)
          ? (json.data as SessionItem[])
          : Array.isArray(json.items)
            ? (json.items as SessionItem[])
            : [];

        const resolved = sessionItems.map((s) => ({
          ...s,
          ano_resolvido: extrairAnoLetivo(s.ano_letivo ?? s.nome ?? s.data_inicio ?? s.data_fim),
        }));

        setSessions(resolved);

        const activeSession = resolved.find((s) => s.status === "ativa" && s.ano_resolvido);
        const firstWithAno = resolved.find((s) => s.ano_resolvido);

        setSelectedAno((prev) => prev ?? activeSession?.ano_resolvido ?? firstWithAno?.ano_resolvido ?? new Date().getFullYear());
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    }
  }, []);

  const fetchCursos = useCallback(async () => {
    try {
      const res = await fetch("/api/secretaria/cursos");
      const json = await res.json();
      if (json.ok) setCursos(Array.isArray(json.items) ? (json.items as CursoItem[]) : []);
    } catch (error) {
      console.error("Failed to fetch cursos", error);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchCursos();
  }, [fetchSessions, fetchCursos]);

  useEffect(() => {
    async function fetchClasses() {
      if (!selectedCurso) {
        setClasses([]);
        setSelectedClasse("");
        return;
      }
      try {
        const res = await fetch(`/api/secretaria/classes?curso_id=${selectedCurso}`);
        const json = await res.json();
        if (json.ok) setClasses(Array.isArray(json.items) ? (json.items as ClasseItem[]) : []);
      } catch (error) {
        console.error("Failed to fetch classes", error);
      }
    }
    fetchClasses();
  }, [selectedCurso]);

  useEffect(() => {
    async function fetchTurmas() {
      if (!selectedClasse) {
        setTurmas([]);
        setSelectedTurma("");
        return;
      }
      try {
        const params = new URLSearchParams({ classe_id: selectedClasse });
        if (anoLetivoAtivo) params.set("ano", String(anoLetivoAtivo));
        const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`);
        const json = await res.json();
        if (json.ok) setTurmas(Array.isArray(json.items) ? (json.items as TurmaItem[]) : []);
      } catch (error) {
        console.error("Failed to fetch turmas", error);
      }
    }
    fetchTurmas();
  }, [selectedClasse, anoLetivoAtivo]);

  const replaceParams = (fn: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    fn(p);
    const qs = p.toString();
    if (pathname) {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  };

  const handleRemoveStatus = (s: string) => {
    replaceParams((p) => {
      const currentIn = p.get("status_in");
      const current = p.get("status");
      if (currentIn) {
        const arr = currentIn
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .filter((v) => v !== s);
        if (arr.length > 0) p.set("status_in", arr.join(","));
        else p.delete("status_in");
      } else if (current === s) {
        p.delete("status");
      }
      p.delete("page");
    });
  };

  const handleClearStatuses = () => {
    replaceParams((p) => {
      p.delete("status");
      p.delete("status_in");
      p.delete("page");
    });
  };

  const load = useCallback(async (p: number) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        page: String(p),
        pageSize: String(pageSize),
      });

      if (anoLetivoAtivo) params.set("ano", String(anoLetivoAtivo));

      if (selectedTurma) params.set("turma_id", selectedTurma);
      else if (showPendentes) params.set("turma_id", "null");

      if (selectedClasse) params.set("classe_id", selectedClasse);
      if (selectedCurso) params.set("curso_id", selectedCurso);
      if (selectedEnsino) params.set("ensino", selectedEnsino);

      if (statusFromQuery) params.set("status", statusFromQuery);
      if (statusInFromQuery) params.set("status_in", statusInFromQuery);

      const res = await fetch(`/api/secretaria/admissoes/matriculas?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar matrículas");

      if (activeRequestRef.current === requestId) {
        setItems(Array.isArray(json.items) ? json.items : []);
        setTotal(json.total || 0);
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      console.error(error);
    } finally {
      if (activeRequestRef.current === requestId) setLoading(false);
    }
  }, [
    anoLetivoAtivo,
    pageSize,
    q,
    selectedClasse,
    selectedCurso,
    selectedEnsino,
    selectedTurma,
    showPendentes,
    statusFromQuery,
    statusInFromQuery,
  ]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    load(1);
    setPage(1);
  }, [load, selectedAno]);
  useEffect(() => {
    load(page);
  }, [load, page]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return counts;
  }, [items]);

  const turmasUnicas = useMemo(
    () => new Set(items.map((item) => item.turma_nome).filter(Boolean)),
    [items]
  );

  const handleOpenStatusForm = (matricula: Item) => {
    setSelectedMatricula(matricula);
    setShowStatusForm(true);
  };

  const handleOpenTransferForm = (matricula: Item) => {
    setSelectedMatricula(matricula);
    setShowTransferForm(true);
  };

  // NOTE: Full original UI from main restored.
  // Cascading filters, virtualized table, modals — unchanged from main.
  // Theme migration deferred for this large file to avoid UI simplification.

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Matrículas</h1>
          <p className="text-sm font-medium text-slate-500">Administre o estado e turmas dos alunos.</p>
        </div>

        <Link
          href={novaMatriculaHref}
          aria-disabled={!resolvedSlug}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold",
            resolvedSlug ? "bg-amber text-white hover:brightness-95" : "bg-slate-300 text-white pointer-events-none cursor-not-allowed",
            "focus:outline-none focus:ring-4 focus:ring-amber/20"
          )}
        >
          <UserPlus className="h-4 w-4" />
          Nova Matrícula
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Matrículas" value={total} icon={Users} tone="slate" />
        <KpiCard title="Matrículas Ativas" value={statusCounts["ativa"] || 0} icon={UserCheck} tone="emerald" />
        <KpiCard title="Pendentes (a ativar)" value={statusCounts["pendente"] || 0} icon={Clock} tone="amber" />
        <KpiCard title="Turmas Envolvidas" value={turmasUnicas.size} icon={BookOpen} tone="violet" />
      </div>

      {/* Card Principal */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, BI..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cn(
                  "w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none",
                  "focus:ring-4 focus:ring-amber/20 focus:border-amber"
                )}
              />
            </div>

            <select
              value={selectedAno ?? ""}
              onChange={(e) => {
                const newAno = Number(e.target.value);
                setSelectedAno(Number.isFinite(newAno) ? newAno : null);
                setSelectedTurma("");
              }}
              className={cn(
                "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
                "focus:ring-4 focus:ring-amber/20 focus:border-amber"
              )}
            >
              <option value="">Ano letivo</option>
              {sessions
                .map((s) => ({ ...s, ano_resolvido: extrairAnoLetivo(s.ano_letivo ?? s.nome ?? s.data_inicio ?? s.data_fim) }))
                .filter((s) => s.ano_resolvido)
                .map((s) => (
                  <option key={s.id} value={s.ano_resolvido as number}>
                    {s.nome || `${s.ano_resolvido}/${(s.ano_resolvido as number) + 1}`}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-2">
            <ToolbarButton
              href={`${secretariaBase}/admissoes/matriculas/export?format=csv&ano=${anoLetivoAtivo}&q=${q}`}
              label="CSV"
            />
            <ToolbarButton
              href={`${secretariaBase}/admissoes/matriculas/export?format=json&ano=${anoLetivoAtivo}&q=${q}`}
              label="JSON"
            />
          </div>
        </div>

        {/* Cascading Filters — original structure preserved */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/30 p-4">
          <select
            value={selectedEnsino}
            onChange={(e) => {
              setSelectedEnsino(e.target.value);
              setSelectedCurso("");
              setSelectedClasse("");
              setSelectedTurma("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-amber/20 focus:border-amber"
          >
            <option value="">Todos os ensinos</option>
            <option value="primario">Primário</option>
            <option value="secundario">Secundário</option>
            <option value="medio">Médio</option>
          </select>

          <select
            value={selectedCurso}
            onChange={(e) => {
              setSelectedCurso(e.target.value);
              setSelectedClasse("");
              setSelectedTurma("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-amber/20 focus:border-amber"
          >
            <option value="">Todos os cursos</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome || c.id}</option>
            ))}
          </select>

          <select
            value={selectedClasse}
            onChange={(e) => {
              setSelectedClasse(e.target.value);
              setSelectedTurma("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-amber/20 focus:border-amber"
          >
            <option value="">Todas as classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome || c.id}</option>
            ))}
          </select>

          <select
            value={selectedTurma}
            onChange={(e) => setSelectedTurma(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-amber/20 focus:border-amber"
          >
            <option value="">Todas as turmas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome || t.turma_codigo || t.id}</option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showPendentes}
              onChange={(e) => setShowPendentes(e.target.checked)}
              className="rounded border-slate-300"
            />
            Só sem turma
          </label>

          {statusFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {statusFilters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleRemoveStatus(s)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                >
                  {s} ×
                </button>
              ))}
              <button type="button" onClick={handleClearStatuses} className="text-xs font-bold text-slate-500 hover:text-slate-800">
                limpar
              </button>
            </div>
          ) : null}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Aluno</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Turma</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-slate-100 bg-white"
                style={
                  hasRows
                    ? { position: "relative", display: "block", height: rowVirtualizer.getTotalSize() }
                    : undefined
                }
              >
                {isInitialLoading ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      <Skeleton className="mx-auto h-4 w-40" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Nenhuma matrícula encontrada.
                    </td>
                  </tr>
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = items[virtualRow.index];
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors"
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
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{item.aluno_nome || "—"}</div>
                          <div className="text-xs text-slate-500 font-mono">{item.numero_matricula || item.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatTurmaDisplayName({
                            nome: item.turma_nome,
                            sala: item.sala,
                            turno: item.turno,
                            classe_nome: item.classe_nome,
                          }) || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenStatusForm(item)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Alterar status"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTransferForm(item)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Transferir"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </button>
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
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <span>
            Página {page} de {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {showStatusForm && selectedMatricula ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
            <StatusForm
              matriculaId={selectedMatricula.id}
              currentStatus={selectedMatricula.status}
              onClose={() => {
                setShowStatusForm(false);
                setSelectedMatricula(null);
              }}
              onSaved={() => {
                setShowStatusForm(false);
                setSelectedMatricula(null);
                load(page);
              }}
            />
          </div>
        </div>
      ) : null}

      {showTransferForm && selectedMatricula ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
            <TransferForm
              matriculaId={selectedMatricula.id}
              alunoNome={selectedMatricula.aluno_nome || ""}
              currentTurmaId={selectedMatricula.turma_id}
              onClose={() => {
                setShowTransferForm(false);
                setSelectedMatricula(null);
              }}
              onSaved={() => {
                setShowTransferForm(false);
                setSelectedMatricula(null);
                load(page);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
