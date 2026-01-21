"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
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
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

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

  // Filtros URL
  const turmaIdFromQuery = searchParams.get("turma_id");
  const statusFromQuery = searchParams.get("status");
  const statusInFromQuery = searchParams.get("status_in");
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
        if (anoLetivoAtivo) params.set('ano', String(anoLetivoAtivo));
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
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    fn(p);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
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

  // --- RENDER ---
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
          href="/secretaria/admissoes/nova"
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold",
            "bg-klasse-gold text-white hover:brightness-95",
            "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
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
        <KpiCard title="Pendentes (a ativar)" value={statusCounts["pendente"] || 0} icon={Loader2} tone="amber" />
        <KpiCard title="Turmas Envolvidas" value={turmasUnicas.size} icon={BookOpen} tone="violet" />
      </div>

      {/* Card Principal */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, BI..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cn(
                  "w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none",
                  "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                )}
              />
            </div>

            {/* Session */}
            <select
              value={selectedAno ?? ""}
              onChange={(e) => {
                const newAno = Number(e.target.value);
                setSelectedAno(Number.isFinite(newAno) ? newAno : null);
                setSelectedTurma("");
              }}
              className={cn(
                "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
                "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
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

          {/* Exports */}
          <div className="flex gap-2">
            <ToolbarButton
              href={`/secretaria/admissoes/matriculas/export?format=csv&ano=${anoLetivoAtivo}&q=${q}`}
              label="CSV"
            />
            <ToolbarButton
              href={`/secretaria/admissoes/matriculas/export?format=json&ano=${anoLetivoAtivo}&q=${q}`}
              label="JSON"
            />
          </div>
        </div>

        {/* Cascading Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 p-5">
          <select
            value={selectedEnsino}
            onChange={(e) => setSelectedEnsino(e.target.value)}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
              "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            )}
          >
            <option value="">Ensino/Nível</option>
            <option value="primario">Ensino Primário</option>
            <option value="ciclo1">I Ciclo</option>
            <option value="ciclo2">II Ciclo</option>
          </select>

          <select
            value={selectedCurso}
            onChange={(e) => setSelectedCurso(e.target.value)}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
              "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            )}
          >
            <option value="">Curso</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nome}
              </option>
            ))}
          </select>

          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
              "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            )}
          >
            <option value="">Classe</option>
            {classes.map((classe) => (
              <option key={classe.id} value={classe.id}>
                {classe.nome}
              </option>
            ))}
          </select>

          <select
            value={selectedTurma}
            onChange={(e) => setSelectedTurma(e.target.value)}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none sm:w-auto",
              "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            )}
          >
            <option value="">Turma</option>
            {turmas.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPendentes}
              onChange={(e) => setShowPendentes(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            />
            <span className="text-sm font-medium text-slate-700">Pendentes de Enturmação</span>
          </label>
        </div>

        {/* Active Filter Tags */}
        {(statusFilters.length > 0 || turmaIdFromQuery) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <span className="mr-2 text-xs font-bold uppercase text-slate-400">Filtros:</span>

            {turmaIdFromQuery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200/70">
                <span className="truncate max-w-[200px]">Turma: {items[0]?.turma_nome || turmaIdFromQuery}</span>
                <button
                  onClick={() => replaceParams((p) => { p.delete("turma_id"); p.delete("page"); })}
                  className="ml-1 hover:text-violet-900"
                >
                  ×
                </button>
              </span>
            )}

            {statusFilters.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200/70"
              >
                <span className="truncate max-w-[200px]">Status: {s}</span>
                <button onClick={() => handleRemoveStatus(s)} className="ml-1 hover:text-sky-900">
                  ×
                </button>
              </span>
            ))}

            <button
              onClick={handleClearStatuses}
              className="ml-2 text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <div ref={scrollParentRef} className="max-h-[560px] overflow-y-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-100">
            <thead className="bg-white sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Matrícula
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Aluno
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Turma
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y divide-slate-50 bg-white"
              style={
                hasRows
                  ? {
                      position: "relative",
                      display: "block",
                      height: rowVirtualizer.getTotalSize(),
                    }
                  : undefined
              }
            >
              {loading ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-klasse-gold" />
                    A carregar registos...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    Nenhuma matrícula encontrada com estes filtros.
                  </td>
                </tr>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const m = items[virtualRow.index];
                  const dataMatriculaFmt = (() => {
                    if (!m.data_matricula) return null;
                    const d = new Date(m.data_matricula);
                    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
                  })();

                  const fichaHref = m.aluno_id ? `/secretaria/alunos/${m.aluno_id}/ficha` : null;
                  const statusKey = (m.status || "").toLowerCase();
                  const numeroMatriculaVisivel =
                    statusKey === "ativa" && m.numero_matricula
                      ? m.numero_matricula
                      : "Gerado ao ativar";

                  return (
                    <tr
                      key={m.id}
                      className="group transition-colors hover:bg-slate-50/70"
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
                      {/* Matrícula */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="w-fit rounded-xl bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                          {numeroMatriculaVisivel}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span>ID: {m.id.slice(0, 6)}</span>

                          {m.numero_chamada ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                              Chamada #{m.numero_chamada}
                            </span>
                          ) : null}

                          {dataMatriculaFmt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                              {dataMatriculaFmt}
                            </span>
                          ) : null}

                          {statusKey !== "ativa" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200/70">
                              Número só é gerado em status ativa
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aluno */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {fichaHref ? (
                          <Link href={fichaHref} className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                              {m.aluno_nome ? m.aluno_nome.substring(0, 2).toUpperCase() : "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-900 group-hover:text-klasse-gold">
                                {m.aluno_nome || "Aluno Desconhecido"}
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 text-slate-500">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400 ring-1 ring-slate-200">
                              {m.aluno_nome ? m.aluno_nome.substring(0, 2).toUpperCase() : "?"}
                            </div>
                            <div className="truncate text-sm font-bold text-slate-400">
                              {m.aluno_nome || "Aluno Desconhecido"}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Turma */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {m.turma_nome ? (
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              <span className="text-klasse-gold">{m.classe_nome}</span> / {m.turma_nome}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {m.turno ? <span>{m.turno}</span> : null}
                              {m.sala ? <span className="ml-2">Sala: {m.sala}</span> : null}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-300">Sem turma</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <StatusBadge status={m.status} />
                      </td>

                      {/* Ações */}
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleOpenStatusForm(m)}
                            title="Alterar Status"
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleOpenTransferForm(m)}
                            title="Transferir"
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                          </button>

                          <Link
                            href={`/api/secretaria/admissoes/matriculas/${m.id}/declaracao`}
                            target="_blank"
                            title="Declaração"
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>

                          <button
                            title="Mais"
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                          >
                            <MoreVertical className="h-4 w-4" />
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

        {/* Footer Paginação */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-xs font-medium text-slate-500">
            Página {page} de {totalPages} • Total: {total}
          </p>

          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modais */}
      {showStatusForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Alterar Status</h2>
              <button
                onClick={() => setShowStatusForm(false)}
                className="rounded-full p-2 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
              >
                <XCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <StatusForm
              matriculaId={selectedMatricula.id}
              currentStatus={selectedMatricula.status}
              onSuccess={() => {
                setShowStatusForm(false);
                load(page);
              }}
            />
          </div>
        </div>
      )}

      {showTransferForm && selectedMatricula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Transferir Aluno</h2>
              <button
                onClick={() => setShowTransferForm(false)}
                className="rounded-full p-2 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
              >
                <XCircle className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <TransferForm
              matriculaId={selectedMatricula.id}
              anoLetivo={anoLetivoAtivo}
              onSuccess={() => {
                setShowTransferForm(false);
                load(page);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
