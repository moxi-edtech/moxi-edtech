"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  Check,
  ChevronsUpDown,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Search,
} from "lucide-react";

type TurmaItem = {
  id: string;
  turma_nome?: string | null;
  nome?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
  curso_nome?: string | null;
  ano_letivo?: number | null;
  ocupacao_atual?: number | null;
  capacidade_maxima?: number | null;
  status_validacao?: string | null;
};

type PeriodoItem = {
  id: string;
  numero: number;
  tipo: string;
};

type AnoLetivoItem = {
  id: string;
  nome: string;
  status: string;
  ano_letivo: number;
};

type DocKey =
  | "attendance"
  | "nominal"
  | "blank"
  | "mini"
  | "pauta-geral"
  | "pauta-anual"
  | "excel";

type FormatKey = "pdf_individual" | "pdf_consolidado" | "excel";

type JobItem = {
  id: string;
  documento_tipo?: string | null;
  status: string;
  total_turmas: number;
  processed: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  download_url?: string | null;
  error_message?: string | null;
};

type DirectHistoryItem = {
  id: string;
  label: string;
  format: FormatKey;
  createdAt: string;
  href: string;
};

const MONTH_OPTIONS = [
  { v: "01", l: "Jan" },
  { v: "02", l: "Fev" },
  { v: "03", l: "Mar" },
  { v: "04", l: "Abr" },
  { v: "05", l: "Mai" },
  { v: "06", l: "Jun" },
  { v: "07", l: "Jul" },
  { v: "08", l: "Ago" },
  { v: "09", l: "Set" },
  { v: "10", l: "Out" },
  { v: "11", l: "Nov" },
  { v: "12", l: "Dez" },
] as const;

const DIRECT_HISTORY_LIMIT = 8;

const DOCS: Array<{
  key: DocKey;
  label: string;
  hint: string;
  icon: ReactNode;
  formats: FormatKey[];
  requiresPeriodo?: boolean;
  queueLabel?: string;
}> = [
  {
    key: "attendance",
    label: "Mapa de Frequência",
    hint: "PDF nominal da turma para o mês selecionado.",
    icon: <CalendarCheck size={14} />,
    formats: ["pdf_individual"],
  },
  {
    key: "nominal",
    label: "Lista Nominal",
    hint: "Lista oficial da turma pronta para impressão.",
    icon: <FileText size={14} />,
    formats: ["pdf_individual", "pdf_consolidado"],
    queueLabel: "Lista nominal",
  },
  {
    key: "blank",
    label: "Pauta em Branco",
    hint: "Modelo para preenchimento manual.",
    icon: <LayoutDashboard size={14} />,
    formats: ["pdf_individual"],
  },
  {
    key: "mini",
    label: "Mini-Pautas",
    hint: "Versão reduzida para circulação interna.",
    icon: <BookOpen size={14} />,
    formats: ["pdf_individual"],
  },
  {
    key: "pauta-geral",
    label: "Pauta Geral",
    hint: "Documento trimestral com base no período selecionado.",
    icon: <BookOpen size={14} />,
    formats: ["pdf_individual", "pdf_consolidado"],
    requiresPeriodo: true,
    queueLabel: "Pauta trimestral",
  },
  {
    key: "pauta-anual",
    label: "Pauta Anual",
    hint: "Resumo anual oficial da turma.",
    icon: <GraduationCap size={14} />,
    formats: ["pdf_individual", "pdf_consolidado"],
    queueLabel: "Pauta anual",
  },
  {
    key: "excel",
    label: "Pauta Digital (Excel)",
    hint: "Planilha de apoio para tratamento digital.",
    icon: <FileSpreadsheet size={14} />,
    formats: ["excel"],
  },
];

const formatLabels: Record<FormatKey, string> = {
  pdf_individual: "PDF individual",
  pdf_consolidado: "PDF consolidado",
  excel: "Excel",
};

const queueDocKeys = new Set<DocKey>(["nominal", "pauta-geral", "pauta-anual"]);

function turmaLabel(turma: TurmaItem) {
  return turma.turma_nome || turma.nome || "Turma sem nome";
}

function uniqSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-PT")
  );
}

function jobLabel(documentoTipo?: string | null) {
  if (documentoTipo === "lista_nominal") return "Lista nominal consolidada";
  if (documentoTipo === "pauta_trimestral") return "Pauta geral consolidada";
  if (documentoTipo === "pauta_anual") return "Pauta anual consolidada";
  return documentoTipo || "Lote de documentos";
}

function buildDocUrl(
  type: DocKey,
  turmaId: string,
  month: string,
  periodoId: string,
  periodoNumero: number | null
) {
  switch (type) {
    case "attendance":
      return `/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf&month=${month}`;
    case "nominal":
      return `/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf`;
    case "blank":
      return `/api/secretaria/turmas/${turmaId}/pauta-branca`;
    case "mini":
      return `/api/secretaria/turmas/${turmaId}/mini-pautas`;
    case "pauta-geral":
      return `/api/secretaria/turmas/${turmaId}/pauta-geral?periodo_letivo_id=${periodoId}&periodoNumero=${periodoNumero || 1}`;
    case "pauta-anual":
      return `/api/secretaria/turmas/${turmaId}/pauta-anual`;
    case "excel":
      return `/api/secretaria/turmas/${turmaId}/pauta`;
  }
}

export default function QuickDocHub({ escolaId }: { escolaId?: string | null }) {
  const storageKey = escolaId ? `quick-doc-hub:last-turma:${escolaId}` : null;
  const historyStorageKey = escolaId ? `quick-doc-hub:history:${escolaId}` : null;
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivoItem[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<number | null>(null);
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turmaId, setTurmaId] = useState("");
  const [month, setMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, "0"));
  const [periodoId, setPeriodoId] = useState("");
  const [classeFiltro, setClasseFiltro] = useState("");
  const [cursoFiltro, setCursoFiltro] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [turmaQuery, setTurmaQuery] = useState("");
  const [turmaPickerOpen, setTurmaPickerOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<DocKey[]>(["nominal"]);
  const [format, setFormat] = useState<FormatKey>("pdf_individual");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [directHistory, setDirectHistory] = useState<DirectHistoryItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const hasHydratedLastTurmaRef = useRef(false);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;

    const loadAnos = async () => {
      setLoadingAnos(true);
      try {
        const params = new URLSearchParams({ escola_id: escolaId });
        const res = await fetch(`/api/secretaria/school-sessions?${params.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active || !res.ok || !json.ok || !Array.isArray(json.data)) return;

        const fetched = (json.data as AnoLetivoItem[])
          .filter((item) => typeof item.ano_letivo === "number")
          .sort((a, b) => b.ano_letivo - a.ano_letivo);

        setAnosLetivos(fetched);
        const activeAno = fetched.find((item) => item.status === "ativa")?.ano_letivo ?? fetched[0]?.ano_letivo ?? null;
        setAnoLetivo((current) => current ?? activeAno);
      } catch (error) {
        console.error("Erro ao carregar anos letivos:", error);
      } finally {
        if (active) setLoadingAnos(false);
      }
    };

    void loadAnos();
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const loadPeriodos = async () => {
      setLoadingPeriodos(true);
      try {
        const params = new URLSearchParams({ escola_id: escolaId });
        const res = await fetch(`/api/secretaria/relatorios/mapa-aproveitamento?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          const fetched = Array.isArray(json.filtros?.periodos) ? (json.filtros.periodos as PeriodoItem[]) : [];
          setPeriodos(fetched);
          setPeriodoId((current) => current || fetched[0]?.id || "");
        }
      } catch (error) {
        console.error("Erro ao carregar períodos:", error);
      } finally {
        if (active) setLoadingPeriodos(false);
      }
    };

    void loadPeriodos();
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId || !anoLetivo) return;
    let active = true;

    const loadTurmas = async () => {
      setLoadingTurmas(true);
      try {
        const params = new URLSearchParams({
          ano: String(anoLetivo),
          escola_id: escolaId,
        });
        const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setTurmas(Array.isArray(json.items || json.data) ? (json.items || json.data) : []);
        } else {
          setTurmas([]);
        }
      } catch (error) {
        console.error("Erro ao carregar turmas:", error);
        if (active) setTurmas([]);
      } finally {
        if (active) setLoadingTurmas(false);
      }
    };

    void loadTurmas();
    return () => {
      active = false;
    };
  }, [escolaId, anoLetivo]);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/secretaria/documentos-oficiais/lote", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && Array.isArray(json.items)) {
        setJobs(json.items as JobItem[]);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de lotes:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const hasActiveJobs = jobs.some((job) => job.status === "PROCESSING");
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs, loadJobs]);

  useEffect(() => {
    if (!historyStorageKey) return;
    try {
      const raw = window.localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DirectHistoryItem[];
      if (Array.isArray(parsed)) setDirectHistory(parsed);
    } catch {}
  }, [historyStorageKey]);

  useEffect(() => {
    if (!historyStorageKey) return;
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(directHistory.slice(0, DIRECT_HISTORY_LIMIT)));
    } catch {}
  }, [directHistory, historyStorageKey]);

  useEffect(() => {
    if (!storageKey || turmas.length === 0 || turmaId || hasHydratedLastTurmaRef.current) return;
    hasHydratedLastTurmaRef.current = true;
    try {
      const lastTurmaId = window.localStorage.getItem(storageKey);
      if (lastTurmaId && turmas.some((turma) => turma.id === lastTurmaId)) {
        setTurmaId(lastTurmaId);
      }
    } catch {}
  }, [storageKey, turmaId, turmas]);

  useEffect(() => {
    if (!storageKey || !turmaId) return;
    try {
      window.localStorage.setItem(storageKey, turmaId);
    } catch {}
  }, [storageKey, turmaId]);

  const classes = useMemo(() => uniqSorted(turmas.map((turma) => turma.classe_nome)), [turmas]);
  const cursos = useMemo(() => uniqSorted(turmas.map((turma) => turma.curso_nome)), [turmas]);
  const turnos = useMemo(() => uniqSorted(turmas.map((turma) => turma.turno)), [turmas]);

  const turmasFiltradas = useMemo(() => {
    const term = turmaQuery.trim().toLowerCase();
    return turmas.filter((turma) => {
      const label = turmaLabel(turma).toLowerCase();
      const classe = String(turma.classe_nome ?? "").toLowerCase();
      const curso = String(turma.curso_nome ?? "").toLowerCase();
      const turno = String(turma.turno ?? "");

      if (classeFiltro && turma.classe_nome !== classeFiltro) return false;
      if (cursoFiltro && turma.curso_nome !== cursoFiltro) return false;
      if (turnoFiltro && turno !== turnoFiltro) return false;
      if (!term) return true;

      return label.includes(term) || classe.includes(term) || curso.includes(term);
    });
  }, [turmaQuery, classeFiltro, cursoFiltro, turnoFiltro, turmas]);

  useEffect(() => {
    if (!turmaId) return;
    if (!turmas.some((turma) => turma.id === turmaId)) {
      setTurmaId("");
    }
  }, [turmaId, turmas]);

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === turmaId) ?? null,
    [turmaId, turmas]
  );

  const selectedPeriodo = useMemo(
    () => periodos.find((periodo) => periodo.id === periodoId) ?? null,
    [periodoId, periodos]
  );

  useEffect(() => {
    if (selectedTurma) {
      setTurmaQuery(turmaLabel(selectedTurma));
    }
  }, [selectedTurma]);

  useEffect(() => {
    setSelectedDocs((current) => current.filter((docKey) => DOCS.find((doc) => doc.key === docKey)?.formats.includes(format)));
  }, [format]);

  const statusResumo = selectedTurma
    ? [
        selectedTurma.classe_nome ? `Classe ${selectedTurma.classe_nome}` : null,
        selectedTurma.curso_nome ? selectedTurma.curso_nome : null,
        selectedTurma.turno ? `Turno ${selectedTurma.turno}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : null;

  const selectedDocDefs = DOCS.filter((doc) => selectedDocs.includes(doc.key));

  const docDisabledReason = useCallback(
    (docKey: DocKey) => {
      const doc = DOCS.find((item) => item.key === docKey);
      if (!doc) return "Documento indisponível.";
      if (!doc.formats.includes(format)) {
        return format === "excel"
          ? "Este documento não tem versão Excel."
          : "Este documento ainda não suporta PDF consolidado.";
      }
      if (!selectedTurma) return "Selecione uma turma.";
      if (doc.requiresPeriodo && !periodoId) return "Selecione um período.";
      return null;
    },
    [format, periodoId, selectedTurma]
  );

  const addDirectHistory = useCallback((entry: Omit<DirectHistoryItem, "id" | "createdAt">) => {
    setDirectHistory((current) => [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...entry,
      },
      ...current,
    ].slice(0, DIRECT_HISTORY_LIMIT));
  }, []);

  const runDirectDownloads = useCallback(() => {
    if (!selectedTurma) return;
    for (const doc of selectedDocDefs) {
      const url = buildDocUrl(doc.key, selectedTurma.id, month, periodoId, selectedPeriodo?.numero ?? null);
      window.open(url, "_blank");
      addDirectHistory({
        label: `${doc.label} • ${turmaLabel(selectedTurma)}`,
        format,
        href: url,
      });
    }
  }, [addDirectHistory, format, month, periodoId, selectedDocDefs, selectedPeriodo?.numero, selectedTurma]);

  const runQueuedEmission = useCallback(async () => {
    if (!selectedTurma || !escolaId) return;
    for (const doc of selectedDocDefs) {
      if (!queueDocKeys.has(doc.key)) continue;

      if (doc.key === "nominal") {
        await fetch(`/api/escola/${encodeURIComponent(escolaId)}/admin/turmas/bulk-print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turma_ids: [selectedTurma.id] }),
        });
        continue;
      }

      const tipo = doc.key === "pauta-geral" ? "trimestral" : "anual";
      const body =
        tipo === "trimestral"
          ? { turma_ids: [selectedTurma.id], tipo, periodo_letivo_id: periodoId }
          : { turma_ids: [selectedTurma.id], tipo };

      await fetch("/api/secretaria/documentos-oficiais/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  }, [escolaId, periodoId, selectedDocDefs, selectedTurma]);

  const canSubmit =
    selectedDocs.length > 0 &&
    selectedDocDefs.every((doc) => docDisabledReason(doc.key) === null) &&
    !submitting;

  const handleEmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (format === "pdf_consolidado") {
        await runQueuedEmission();
        await loadJobs();
        setFeedback("Lote enviado para a fila de emissão.");
      } else {
        runDirectDownloads();
        setFeedback("Downloads iniciados em novas abas.");
      }
    } catch (error) {
      console.error("Erro ao emitir documentos:", error);
      setFeedback("Não conseguimos concluir a emissão agora.");
    } finally {
      setSubmitting(false);
    }
  };

  const recentJobs = jobs
    .filter((job) => ["lista_nominal", "pauta_trimestral", "pauta_anual"].includes(String(job.documento_tipo ?? "")))
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Emissão Rápida por Turma</p>
          <p className="mt-1 text-sm text-slate-500">
            Selecione vários documentos, escolha o formato e acompanhe a fila no mesmo painel.
          </p>
        </div>
        {(loadingTurmas || loadingPeriodos || loadingAnos || submitting) && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
            <Loader2 size={14} className="animate-spin text-slate-400" />
            {submitting ? "A processar emissão" : "A preparar contexto"}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Ano letivo">
          <select
            value={anoLetivo ?? ""}
            onChange={(event) => setAnoLetivo(event.target.value ? Number(event.target.value) : null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          >
            <option value="">{loadingAnos ? "A carregar..." : "Selecione"}</option>
            {anosLetivos.map((ano) => (
              <option key={ano.id} value={ano.ano_letivo}>
                {ano.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Classe">
          <select
            value={classeFiltro}
            onChange={(event) => setClasseFiltro(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          >
            <option value="">Todas</option>
            {classes.map((classe) => (
              <option key={classe} value={classe}>
                {classe}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Curso">
          <select
            value={cursoFiltro}
            onChange={(event) => setCursoFiltro(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          >
            <option value="">Todos</option>
            {cursos.map((curso) => (
              <option key={curso} value={curso}>
                {curso}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Turno">
          <select
            value={turnoFiltro}
            onChange={(event) => setTurnoFiltro(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          >
            <option value="">Todos</option>
            {turnos.map((turno) => (
              <option key={turno} value={turno}>
                {turno}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
        <div className="space-y-3">
          <Field
            label="Turma"
            hint={
              turmasFiltradas.length > 0
                ? `${turmasFiltradas.length} turma${turmasFiltradas.length !== 1 ? "s" : ""} disponível${turmasFiltradas.length !== 1 ? "eis" : ""}`
                : "Nenhuma turma encontrada para os filtros atuais"
            }
          >
            <div className="relative">
              <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
                <Search size={16} />
              </div>
              <input
                value={turmaQuery}
                onFocus={() => setTurmaPickerOpen(true)}
                onChange={(event) => {
                  setTurmaPickerOpen(true);
                  setTurmaQuery(event.target.value);
                  if (turmaId) {
                    setTurmaId("");
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    setTurmaPickerOpen(false);
                    if (selectedTurma) {
                      setTurmaQuery(turmaLabel(selectedTurma));
                    }
                  }, 120);
                }}
                placeholder={loadingTurmas ? "Carregando turmas..." : "Pesquise por turma, classe ou curso"}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronsUpDown size={16} />
              </div>

              {turmaPickerOpen ? (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {turmasFiltradas.length > 0 ? (
                    <div className="space-y-1">
                      {turmasFiltradas.map((turma) => {
                        const active = turma.id === turmaId;
                        return (
                          <button
                            key={turma.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setTurmaId(turma.id);
                              setTurmaQuery(turmaLabel(turma));
                              setTurmaPickerOpen(false);
                            }}
                            className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                              active ? "bg-klasse-gold/10 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{turmaLabel(turma)}</p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {turma.classe_nome || "Sem classe"} • {turma.curso_nome || "Sem curso"} • {turma.turno || "Sem turno"}
                              </p>
                            </div>
                            {active ? <Check size={16} className="mt-0.5 shrink-0 text-klasse-green" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                      Nenhuma turma encontrada para a pesquisa atual.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Mês do mapa">
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
              >
                {MONTH_OPTIONS.map((item) => (
                  <option key={item.v} value={item.v}>
                    {item.l}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Período">
              <select
                value={periodoId}
                onChange={(event) => setPeriodoId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
              >
                <option value="">{loadingPeriodos ? "A carregar..." : "Selecione"}</option>
                {periodos.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>
                    {periodo.numero}º {periodo.tipo === "TRIMESTRE" ? "Trim" : "Per"}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Formato de saída">
            <div className="grid gap-2 md:grid-cols-3">
              {(Object.keys(formatLabels) as FormatKey[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormat(item)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    format === item
                      ? "border-klasse-gold bg-klasse-gold/10 text-slate-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {formatLabels[item]}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resumo operacional</p>
          {selectedTurma ? (
            <div className="mt-3 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{turmaLabel(selectedTurma)}</h3>
                {statusResumo ? <p className="mt-1 text-xs text-slate-500">{statusResumo}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SummaryBox label="Ocupação" value={`${Number(selectedTurma.ocupacao_atual ?? 0)}`} />
                <SummaryBox
                  label="Capacidade"
                  value={selectedTurma.capacidade_maxima ? String(selectedTurma.capacidade_maxima) : "—"}
                />
                <SummaryBox label="Ano" value={selectedTurma.ano_letivo ? String(selectedTurma.ano_letivo) : "—"} />
                <SummaryBox
                  label="Status"
                  value={selectedTurma.status_validacao ? String(selectedTurma.status_validacao) : "—"}
                />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {format === "pdf_consolidado"
                  ? "O modo consolidado envia documentos compatíveis para a fila e libera o download pelo histórico."
                  : "O modo direto abre os artefatos imediatamente em novas abas."}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Selecione uma turma para ver o contexto da emissão e habilitar os documentos.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Documentos</p>
          <p className="text-xs text-slate-500">
            {selectedDocs.length} selecionado{selectedDocs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DOCS.map((doc) => {
            const disabledReason = docDisabledReason(doc.key);
            const selected = selectedDocs.includes(doc.key);
            return (
              <button
                key={doc.key}
                type="button"
                onClick={() =>
                  setSelectedDocs((current) =>
                    current.includes(doc.key) ? current.filter((item) => item !== doc.key) : [...current, doc.key]
                  )
                }
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-klasse-gold bg-klasse-gold/10"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-slate-600">{doc.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{doc.label}</p>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected ? "border-klasse-gold bg-white text-klasse-green" : "border-slate-200 text-transparent"
                        }`}
                      >
                        <Check size={12} />
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{doc.hint}</p>
                    {disabledReason ? (
                      <p className="mt-2 text-[11px] font-medium text-amber-700">{disabledReason}</p>
                    ) : (
                      <p className="mt-2 text-[11px] text-emerald-700">Compatível com {formatLabels[format].toLowerCase()}.</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">Executar emissão</p>
          <p className="mt-1 text-xs text-slate-500">
            {format === "pdf_consolidado"
              ? "Documentos compatíveis serão enviados para a fila e aparecerão no histórico abaixo."
              : "Os documentos serão gerados imediatamente em novas abas."}
          </p>
          {feedback ? <p className="mt-2 text-xs font-medium text-klasse-green">{feedback}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleEmit()}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {format === "pdf_consolidado" ? "Enviar para a fila" : "Emitir agora"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fila de emissão</p>
              <p className="mt-1 text-xs text-slate-500">Progresso dos documentos consolidados enviados.</p>
            </div>
            {loadingJobs ? <Loader2 size={14} className="animate-spin text-slate-400" /> : null}
          </div>

          <div className="space-y-3">
            {recentJobs.length === 0 ? (
              <EmptyState text="Sem lotes recentes." />
            ) : (
              recentJobs.map((job) => {
                const progress = job.total_turmas > 0 ? Math.round((job.processed / job.total_turmas) * 100) : 0;
                return (
                  <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{jobLabel(job.documento_tipo)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(job.created_at).toLocaleString("pt-PT")}
                        </p>
                      </div>
                      <StatusPill status={job.status} />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-klasse-green transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{job.processed}/{job.total_turmas} processado(s)</span>
                      {job.download_url ? (
                        <a href={job.download_url} className="font-semibold text-klasse-green hover:underline">
                          Baixar ZIP
                        </a>
                      ) : null}
                    </div>
                    {job.error_message ? <p className="mt-2 text-[11px] text-rose-600">{job.error_message}</p> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Histórico de downloads</p>
            <p className="mt-1 text-xs text-slate-500">Registo local das emissões diretas feitas neste hub.</p>
          </div>

          <div className="space-y-3">
            {directHistory.length === 0 ? (
              <EmptyState text="Nenhum download direto registado ainda." />
            ) : (
              directHistory.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatLabels[item.format]} • {new Date(item.createdAt).toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <a href={item.href} target="_blank" rel="noreferrer" className="text-xs font-semibold text-klasse-green hover:underline">
                    Abrir
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "SUCCESS" ? "Concluído" : status === "PROCESSING" ? "Em progresso" : status === "FAILED" ? "Falhou" : status;
  const classes =
    status === "SUCCESS"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "PROCESSING"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${classes}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
      <div className="mb-2 inline-flex rounded-full bg-white p-2 text-slate-400">
        <Clock3 size={14} />
      </div>
      <p>{text}</p>
    </div>
  );
}
