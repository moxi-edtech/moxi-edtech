"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import {
  Loader2,
  Search,
  ArrowLeft,
  Users,
  BookOpen,
  Building2,
  Calendar,
  Eye,
  Link as LinkIcon,
  Plus,
  Trash2,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";

import TurmaForm from "@/components/secretaria/TurmaForm";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

// --- TIPOS ---
interface TurmaItem {
  id: string;
  nome: string;
  turno: string;
  ano_letivo: string | null;
  session_id?: string;
  sala?: string;
  capacidade_maxima?: number;
  ocupacao_atual?: number;
  ultima_matricula: string | null;
  classe_nome?: string;
  curso_nome?: string;
  status_validacao?: "ativo" | "rascunho" | "arquivado";
  turma_codigo?: string;
}

interface TurmasResponse {
  ok: boolean;
  items: TurmaItem[];
  total: number;
  stats: {
    totalTurmas: number;
    totalAlunos: number;
    porTurno: Array<{ turno: string; total: number }>;
  };
  error?: string;
}

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

// --- MICRO UI ---
function KpiCard({
  title,
  value,
  icon: Icon,
  iconWrapClass,
  onClick,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
  iconWrapClass?: string;
  onClick?: (() => void) | null;
}) {
  return (
    <div
      onClick={onClick ?? undefined}
      className={cn(
        "bg-white p-5 rounded-xl ring-1 ring-slate-200 shadow-sm",
        "flex items-start justify-between transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-[1px]"
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-2xl font-black text-slate-900 mt-1 truncate">
          {value}
        </p>
      </div>

      <div
        className={cn(
          "p-3 rounded-xl ring-1 ring-slate-200 bg-slate-50 text-slate-500",
          iconWrapClass
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  integral: "Integral",
  sem_turno: "Sem turno",
};

function TurnoPill({ value, isDraft }: { value: string; isDraft: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        "ring-1",
        isDraft
          ? "bg-amber-50 text-amber-700 ring-amber-200/70"
          : "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      {TURNO_LABELS[value] || value}
    </span>
  );
}

// --- PAGE ---
export default function AdminTurmasPage() {
  const [turno, setTurno] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modais / gestão
  const [showForm, setShowForm] = useState(false);
  const [editingTurma, setEditingTurma] = useState<TurmaItem | null>(null);
  const [manageTurmaId, setManageTurmaId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[] | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { escolaId } = useEscolaId();

  // --- FILTROS ---
  const filtrosTurno = useMemo(() => {
    const porTurno = data?.stats?.porTurno ?? [];
    const base = porTurno.map((item) => ({
      id: item.turno,
      label: TURNO_LABELS[item.turno] || item.turno,
      total: item.total,
    }));
    return [{ id: "todos", label: "Todos", total: data?.stats?.totalTurmas ?? 0 }, ...base];
  }, [data]);

  const itensFiltrados = useMemo(() => {
    const itens = data?.items ?? [];
    const lower = busca.trim().toLowerCase();

    return itens.filter((item) => {
      if (statusFilter === "rascunho" && item.status_validacao !== "rascunho") return false;
      if (statusFilter === "ativos" && item.status_validacao === "rascunho") return false;

      if (turno !== "todos" && (item.turno ?? "sem_turno") !== turno) return false;

      const nomeSafe = (item.nome || "").toLowerCase();
      const codigoSafe = (item.turma_codigo || "").toLowerCase();

      if (!lower) return true;
      return nomeSafe.includes(lower) || codigoSafe.includes(lower);
    });
  }, [data, turno, busca, statusFilter]);

  // --- LÓGICA DE SELEÇÃO ---
  const pendingItems = useMemo(() => {
    if (statusFilter !== "rascunho") return [];
    return itensFiltrados.filter((item) => item.status_validacao === "rascunho");
  }, [itensFiltrados, statusFilter]);

  const isAllSelected = useMemo(() => {
    if (pendingItems.length === 0) return false;
    return pendingItems.every((item) => selectedIds.has(item.id));
  }, [pendingItems, selectedIds]);

  const handleSelectAll = () => {
    const newIds = new Set(selectedIds);
    if (isAllSelected) {
      pendingItems.forEach((item) => newIds.delete(item.id));
    } else {
      pendingItems.forEach((item) => newIds.add(item.id));
    }
    setSelectedIds(newIds);
  };

  // Limpa seleção ao mudar filtros
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, turno, busca]);


  // --- FETCH ---
  const fetchData = async () => {
    try {
      setLoading(true);
      if (!escolaId) return;

      const params = new URLSearchParams();
      if (turno !== "todos") params.set("turno", turno);
      if (statusFilter !== "todos") params.set("status", statusFilter); // NEW: Add statusFilter to params

      const url = buildEscolaUrl(escolaId, "/turmas", params);
      const res = await fetch(url, {
        cache: "force-cache",
        headers: { "X-Proxy-Used": "canonical" },
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar");
      setData(json);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (escolaId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno, statusFilter, escolaId]); // NEW: Add statusFilter to dependency array

  const rascunhosCount = useMemo(() => {
    return data?.items.filter((t) => t.status_validacao === "rascunho").length || 0;
  }, [data]);

  // --- AÇÕES ---
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0 || !escolaId || isApproving) return;

    setIsApproving(true);
    try {
      const url = buildEscolaUrl(escolaId, "/admin/turmas/aprovar");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_ids: Array.from(selectedIds) }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao aprovar turmas");
      }

      // TODO: Adicionar toast de sucesso
      setSelectedIds(new Set());
      await fetchData(); // Re-fetch
    } catch (e: any) {
      console.error(e);
      // TODO: Adicionar toast de erro
    } finally {
      setIsApproving(false);
    }
  };

  // --- SMART LABELING ---
  const getDisplayInfo = (t: TurmaItem) => {
    if (t.status_validacao === "rascunho") {
      return {
        label: "Validação Pendente",
        subLabel: t.turma_codigo || "Importada Automaticamente",
        isDraft: true,
        icon: AlertTriangle,
        // KLASSE: gold para alerta/ação
        colorClass: "text-amber-700",
        iconWrap: "bg-amber-50 text-amber-700 ring-amber-200/70",
      };
    }

    const curso = t.curso_nome || "";
    const classe = t.classe_nome || "";

    if (curso && !curso.toLowerCase().includes("geral") && !curso.toLowerCase().includes("base")) {
      return {
        label: curso,
        subLabel: classe,
        icon: GraduationCap,
        colorClass: "text-slate-900",
        iconWrap: "bg-slate-100 text-slate-700 ring-slate-200",
      };
    }

    if (["10ª", "11ª", "12ª", "13ª"].some((c) => classe.includes(c))) {
      return {
        label: "IIº Ciclo (PUNIV)",
        subLabel: classe,
        icon: BookOpen,
        colorClass: "text-slate-900",
        iconWrap: "bg-slate-100 text-slate-700 ring-slate-200",
      };
    }

    return {
      label: "Ensino Geral",
      subLabel: classe || "Classe N/D",
      icon: BookOpen,
      colorClass: "text-slate-900",
      iconWrap: "bg-slate-100 text-slate-700 ring-slate-200",
    };
  };

  const getOcupacao = (t: TurmaItem) => {
    const max = t.capacidade_maxima || 30;
    const atual = t.ocupacao_atual || 0;
    const pct = Math.round((atual / max) * 100);

    let bar = "bg-klasse-green";
    let pctText = "text-klasse-green";
    if (pct >= 90) {
      bar = "bg-red-600";
      pctText = "text-red-600";
    } else if (pct >= 70) {
      bar = "bg-klasse-gold";
      pctText = "text-klasse-gold";
    }

    return { atual, max, pct, bar, pctText };
  };

  const loadAssignments = async (turmaId: string) => {
    setLoadingAssignments(true);
    try {
      if (!escolaId) throw new Error("Escola não identificada");
      const res = await fetch(buildEscolaUrl(escolaId, `/turmas/${turmaId}/disciplinas`), {
        headers: { "X-Proxy-Used": "canonical" },
      });
      const json = await res.json();
      if (json.ok) setAssignments(json.items || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleOpenForm = (turma?: TurmaItem) => {
    setEditingTurma(turma || null);
    setShowForm(true);
  };

  // --- RENDER ---
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Turmas</h1>

          <p className="text-sm font-medium text-slate-500">
            {rascunhosCount > 0 ? (
              <span className="text-amber-700 font-bold inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Atenção: {rascunhosCount} turmas pendentes.
              </span>
            ) : (
              "Administre a estrutura académica e alocação de salas."
            )}
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className={cn(
            "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl",
            "bg-klasse-gold text-white text-sm font-bold hover:brightness-95",
            "shadow-sm active:scale-95",
            "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
          )}
        >
          <Plus className="h-4 w-4" /> Nova Turma
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Turmas" value={data?.stats.totalTurmas || 0} icon={Building2} />

        <KpiCard
          title="Pendentes"
          value={rascunhosCount}
          icon={AlertTriangle}
          iconWrapClass={cn(
            rascunhosCount > 0
              ? "bg-amber-50 text-amber-700 ring-amber-200/70"
              : "bg-slate-100 text-slate-400 ring-slate-200"
          )}
          onClick={() => setStatusFilter("rascunho")}
        />

        <KpiCard title="Alunos Alocados" value={data?.stats.totalAlunos || 0} icon={Users} />

        <KpiCard title="Turnos Ativos" value={filtrosTurno.length - 1} icon={Calendar} />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {/* Tabs status */}
        <div className="flex border-b border-slate-100 px-5 pt-2">
          <button
            onClick={() => setStatusFilter("todos")}
            className={cn(
              "px-4 py-3 text-sm font-bold border-b-2 transition",
              statusFilter === "todos"
                ? "border-klasse-gold text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            Todas
          </button>

          <button
            onClick={() => setStatusFilter("rascunho")}
            className={cn(
              "px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2",
              statusFilter === "rascunho"
                ? "border-klasse-gold text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            Pendentes
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold ring-1",
                rascunhosCount > 0
                  ? "bg-amber-50 text-amber-700 ring-amber-200/70"
                  : "bg-slate-100 text-slate-500 ring-slate-200"
              )}
            >
              {rascunhosCount}
            </span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          {statusFilter === "rascunho" && selectedIds.size > 0 ? (
            <div className="w-full flex justify-between items-center">
              <p className="text-sm font-bold text-slate-700">
                {selectedIds.size} {selectedIds.size === 1 ? "turma selecionada" : "turmas selecionadas"}
              </p>
              <button
                onClick={handleApproveSelected}
                disabled={isApproving}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl",
                  "bg-klasse-green text-white text-sm font-bold hover:brightness-95",
                  "shadow-sm active:scale-95",
                  "focus:outline-none focus:ring-4 focus:ring-klasse-green/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isApproving ? "Aprovando..." : "Aprovar Selecionadas"}
              </button>
            </div>
          ) : (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                id="search-turma"
                name="search-turma"
                placeholder="Buscar turma..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 bg-white text-sm outline-none rounded-xl",
                  "ring-1 ring-slate-200",
                  "focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold focus:outline-none"
                )}
              />
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {filtrosTurno.map((t) => (
              <button
                key={t.id}
                onClick={() => setTurno(t.id)}
                className={cn(
                  "whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  "ring-1",
                  turno === t.id
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {t.label}
                {t.id !== "todos" && (
                  <span
                    className={cn(
                      "ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold",
                      turno === t.id ? "bg-white/15 text-white/90" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {t.total}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="min-w-full divide-y divide-slate-100">
                          <thead className="bg-white sticky top-0 z-10">
                          <tr>
                            {statusFilter === "rascunho" && (
                              <th className="w-12 px-6 py-4">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-klasse-gold focus:ring-klasse-gold/50"
                                  checked={isAllSelected}
                                  onChange={handleSelectAll}
                                />
                              </th>
                            )}<th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Turma
                            </th><th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Curso / Classe
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Local / Turno
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-40">
                  Ocupação
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-50">
              {loading && !data ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-klasse-gold" />
                    Carregando...
                  </td>
                </tr>
              ) : itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-500">
                    Nenhuma turma encontrada.
                  </td>
                </tr>
              ) : (
                itensFiltrados.map((turma) => {
                  const occ = getOcupacao(turma);
                  const info = getDisplayInfo(turma);
                  const InfoIcon = info.icon;
                  const isDraft = turma.status_validacao === "rascunho";

                  const turmaNome = turma.nome || "Sem Nome";
                  const avatarLetras = turmaNome.substring(0, 2).toUpperCase();

                  return (
                    <Fragment key={turma.id}>
                      <tr
                        className={cn(
                          "transition-colors group",
                          isDraft ? "bg-amber-50 hover:bg-amber-100/60" : "hover:bg-slate-50/80"
                        )}
                      >
                        {statusFilter === "rascunho" && (
                          <td className="w-12 px-6">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-klasse-gold focus:ring-klasse-gold/50"
                              checked={selectedIds.has(turma.id)}
                              onChange={() => {
                                const newIds = new Set(selectedIds);
                                if (newIds.has(turma.id)) {
                                  newIds.delete(turma.id);
                                } else {
                                  newIds.add(turma.id);
                                }
                                setSelectedIds(newIds);
                              }}
                            />
                          </td>
                        )}

                        {/* Col 1 */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ring-1 shadow-sm shrink-0",
                                isDraft
                                  ? "bg-amber-100 text-amber-800 ring-amber-200/70"
                                  : "bg-slate-100 text-slate-700 ring-slate-200"
                              )}
                            >
                              {avatarLetras}
                            </div>

                            <div className="min-w-0">
                              {isDraft ? (
                                <p className="truncate font-bold text-sm text-slate-900">{turmaNome}</p>
                              ) : (
                                <Link
                                  href={`/secretaria/turmas/${turma.id}`}
                                  className="truncate block font-bold text-sm text-slate-900 hover:text-klasse-gold hover:underline underline-offset-2 decoration-klasse-gold/40"
                                >
                                  {turmaNome}
                                </Link>
                              )}
                              <p className="text-xs text-slate-400 truncate">{turma.ano_letivo || "-"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Col 2 */}
                        <td className="px-6 py-4">
                          <div className="space-y-1 min-w-0">
                            <div className={cn("flex items-center gap-2 text-sm font-bold", info.colorClass, "min-w-0")}>
                              <span className={cn("p-2 rounded-xl ring-1 shrink-0", info.iconWrap)}>
                                <InfoIcon className="w-4 h-4" />
                              </span>
                              <span className="truncate">{info.label}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{info.subLabel}</span>
                            </div>
                          </div>
                        </td>

                        {/* Col 3 */}
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="text-sm text-slate-700 font-medium flex items-center gap-2 min-w-0">
                              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="truncate">{turma.sala || "Sem sala"}</span>
                            </div>

                            <TurnoPill value={turma.turno} isDraft={isDraft} />
                          </div>
                        </td>

                        {/* Col 4 */}
                        <td className="px-6 py-4">
                          <div className="w-full max-w-[140px]">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-slate-700">
                                {occ.atual}/{occ.max}
                              </span>
                              <span className={cn("font-bold", occ.pctText)}>{occ.pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full", occ.bar)}
                                style={{ width: `${Math.min(occ.pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Col 5 */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {isDraft ? (
                              <button
                                onClick={() => handleOpenForm(turma)}
                                className={cn(
                                  "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold",
                                  "bg-klasse-gold text-white hover:brightness-95",
                                  "focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                )}
                                title="Revisar e ativar"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Revisar
                              </button>
                            ) : (
                              <>
                                <Link
                                  href={`/secretaria/turmas/${turma.id}`}
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                                  title="Ver detalhes"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>

                                <button
                                  onClick={() => {
                                    setManageTurmaId(manageTurmaId === turma.id ? null : turma.id);
                                    loadAssignments(turma.id);
                                  }}
                                  className={cn(
                                    "p-2 rounded-xl transition",
                                    manageTurmaId === turma.id
                                      ? "text-slate-900 bg-slate-100"
                                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                  )}
                                  title="Atribuições"
                                >
                                  <LinkIcon className="w-4 h-4" />
                                </button>

                                <button
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                                  title="Mais"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Painel atribuições */}
                      {manageTurmaId === turma.id && (
                        <tr className="bg-slate-50/50 border-b border-slate-200 animate-in fade-in">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="bg-white ring-1 ring-slate-200 rounded-xl p-4 shadow-sm ml-10">
                              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-500" /> Professores da Turma
                              </h4>

                              {loadingAssignments ? (
                                <div className="text-center text-xs text-slate-400 py-3">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                </div>
                              ) : !assignments || assignments.length === 0 ? (
                                <div className="text-center text-xs text-slate-400 italic py-3">
                                  Nenhum professor atribuído.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {assignments.map((a: any) => (
                                    <div
                                      key={a.id}
                                      className="p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 flex justify-between items-center gap-3"
                                    >
                                      <div className="min-w-0">
                                        <span className="font-bold block text-slate-900 text-xs truncate">
                                          {a.disciplina?.nome}
                                        </span>
                                        <span className="text-slate-500 text-xs truncate block">
                                          {a.professor?.nome}
                                        </span>
                                      </div>

                                      <button
                                        className="text-slate-300 hover:text-red-600 transition shrink-0 p-2 rounded-xl hover:bg-red-50"
                                        title="Remover"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal TurmaForm */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 ring-1 ring-slate-200">
            <div className="flex justify-between mb-6 gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-xl text-slate-900 truncate">
                  {editingTurma
                    ? editingTurma.status_validacao === "rascunho"
                      ? "Validar e Ativar"
                      : "Editar Turma"
                    : "Nova Turma"}
                </h3>
                <p className="text-sm text-slate-500 truncate">
                  {editingTurma?.status_validacao === "rascunho"
                    ? "Confira a sugestão automática e salve para ativar."
                    : "Gerencie os dados da turma."}
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl hover:bg-slate-100 transition shrink-0 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                title="Fechar"
              >
                <ArrowLeft className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <TurmaForm
              escolaId={escolaId || ""}
              initialData={editingTurma}
              onSuccess={() => {
                setShowForm(false);
                fetchData();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
