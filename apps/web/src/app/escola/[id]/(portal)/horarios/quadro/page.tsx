"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { Save, WifiOff, Printer, FileDown, Wand2, ArrowLeft, Undo2, Redo2, CheckCircle2 } from "lucide-react";
import { SchedulerBoard } from "@/components/escola/horarios/SchedulerBoard";
import { HorariosWorkspace } from "@/components/escola/horarios/HorariosWorkspace";
import { DisciplinaModal, type DisciplinaForm } from "@/components/escola/settings/_components/DisciplinaModal";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { timetableStateLabels, type TimetablePublicationState } from "@/lib/horarios/timetable-publication-state";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { mapSlots, useHorarioTurmaData } from "@/hooks/useHorarioData";
import { useHorarioDataContext } from "@/components/escola/horarios/HorarioDataProvider";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { useEscolaId } from "@/hooks/useEscolaId";
import { HorarioWizard } from "@/components/escola/horarios/HorarioWizard";
import { Button } from "@/components/ui/Button";
import { useUserRoleContext } from "@/components/auth/UserRoleProvider";
import { downloadHorarioTurmaPdf } from "@/lib/horarios/downloadHorarioTurmaPdf";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

type PublishWarning = {
  code?: "CARGA_HORARIA_MISSING" | "CARGA_HORARIA_MISMATCH" | string;
  message?: string;
  details?: Array<{ disciplina_id: string; disciplina_nome?: string | null }>;
};

type CurriculoDisciplinaItem = {
  id: string;
  nome: string;
  codigo: string;
  carga_horaria_semanal: number;
  base_weekly_hours?: number | null;
  classificacao?: "core" | "complementar" | "optativa" | null;
  periodos_ativos?: number[] | null;
  entra_no_horario?: boolean | null;
  is_avaliavel?: boolean | null;
  conta_para_media_med?: boolean | null;
  avaliacao_mode_key?: "inherit_school" | "custom" | "inherit_disciplina" | null;
  avaliacao_disciplina_id?: string | null;
  area?: string | null;
  is_core?: boolean | null;
  matrix_ids: string[];
  class_ids?: string[];
  matrix_by_class?: Record<string, string[]>;
};

type CurriculoStatusItem = {
  id: string;
  curso_id: string;
  classe_id: string | null;
  status: "draft" | "published" | "archived" | string;
  version: number;
  ano_letivo_id: string;
};

function formatSlotSaveError(json: any) {
  if (json?.error === "SLOT_TEMPORAL_CONFLICT") {
    const detail = json?.detail;
    const current = detail?.inicio && detail?.fim ? `${detail.inicio}-${detail.fim}` : "um dos tempos";
    const other = detail?.conflicting_with?.inicio && detail?.conflicting_with?.fim
      ? `${detail.conflicting_with.inicio}-${detail.conflicting_with.fim}`
      : "outro tempo";
    return `Conflito de horário: ${current} sobrepõe ${other}. Ajuste os tempos antes de salvar.`;
  }
  if (json?.error === "SLOT_TIME_RANGE_INVALID") {
    return "Horário inválido: a hora de início deve ser anterior à hora de fim.";
  }
  return json?.error || "Falha ao salvar slots.";
}

export default function QuadroHorariosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-muted flex items-center justify-center text-muted-foreground">
        <Spinner className="text-amber" size={24} />
        <span className="ml-3 text-sm">A carregar quadro...</span>
      </div>
    }>
      <QuadroHorariosContent />
    </Suspense>
  );
}

function QuadroHorariosContent() {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const escolaId = params?.id as string;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { userRole } = useUserRoleContext();
  const horarioBasePath = pathname.includes("/operacoes/horarios")
    ? `/escola/${escolaParam}/operacoes/horarios`
    : `/escola/${escolaParam}/horarios`;
  const dashboardHref = pathname.includes("/operacoes")
    ? `/escola/${escolaParam}/operacoes/dashboard`
    : userRole === "secretaria"
    ? `/escola/${escolaParam}/secretaria`
    : `/escola/${escolaParam}/admin/dashboard`;
  const { online } = useOfflineStatus();
  const { success, error, warning, toast: rawToast } = useToast();
  const confirm = useConfirm();
  const [isMounted, setIsMounted] = useState(false);

  const [showWizard, setShowWizard] = useState(false);
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [horarioStatus, setHorarioStatus] = useState<TimetablePublicationState>("sem_horario");
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const [conflictReasons, setConflictReasons] = useState<Record<string, string[]>>({});
  const [autoDraftDirty, setAutoDraftDirty] = useState(false);
  const [validated, setValidated] = useState(false);
  const [undoStack, setUndoStack] = useState<Array<Record<string,string|null>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Record<string,string|null>>>([]);
  const initialQueryApplied = useRef(false);
  const [autoProposalSummary, setAutoProposalSummary] = useState<{ filled: number; total: number; unmet: number } | null>(null);
  const [novaSala, setNovaSala] = useState("");
  const [turmaRefreshToken, setTurmaRefreshToken] = useState(0);
  const [adjustingSlots, setAdjustingSlots] = useState(false);
  const [generatingContraturno, setGeneratingContraturno] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string>("");
  const [curriculoModalOpen, setCurriculoModalOpen] = useState(false);
  const [curriculoDisciplinas, setCurriculoDisciplinas] = useState<CurriculoDisciplinaItem[]>([]);
  const [curriculoClasses, setCurriculoClasses] = useState<Array<{ id: string; nome: string }>>([]);
  const [curriculoSelectedId, setCurriculoSelectedId] = useState<string | null>(null);
  const [professores, setProfessores] = useState<Array<{ id: string; nome: string }>>([]);
  const [revertingAll, setRevertingAll] = useState(false);
  const [curriculoStatusRows, setCurriculoStatusRows] = useState<CurriculoStatusItem[]>([]);
  const [publishingCurriculo, setPublishingCurriculo] = useState(false);
  const curriculoDataCacheRef = useRef(
    new Map<string, { disciplinas: CurriculoDisciplinaItem[]; classes: Array<{ id: string; nome: string }> }>()
  );

  const {
    rawSlots,
    salas,
    turmas,
    loading: baseLoading,
    error: baseError,
    setSalas,
    setTurmas,
    setRawSlots,
    refreshBaseData,
  } = useHorarioDataContext();

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === turmaId) || null,
    [turmaId, turmas]
  );
  const selectedTurno = selectedTurma?.turno?.toUpperCase();
  const turnoId = selectedTurno === "M" ? "matinal" : selectedTurno === "T" ? "tarde" : selectedTurno === "N" ? "noite" : null;
  const { slots, slotLookup } = useMemo(
    () => mapSlots(turnoId ? rawSlots.filter((slot) => slot.turno_id === turnoId) : []),
    [rawSlots, turnoId]
  );

  const {
    aulas,
    grid,
    existingAssignments,
    loading: turmaLoading,
    error: turmaError,
    setAulas,
    setGrid,
  } = useHorarioTurmaData({ escolaId, turmaId, versaoId, slotLookup, refreshToken: turmaRefreshToken });
  const refreshTurmaData = () => setTurmaRefreshToken((prev) => prev + 1);
  const hasMissingLoadInAulas = aulas.some((aula) => aula.missingLoad);
  const slotsHref = turmaId
    ? `${horarioBasePath}/slots?turmaId=${encodeURIComponent(turmaId)}`
    : `${horarioBasePath}/slots`;
  const quadroHref = turmaId
    ? `${horarioBasePath}/quadro?turmaId=${encodeURIComponent(turmaId)}`
    : `${horarioBasePath}/quadro`;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Do not open a wizard implicitly; the workspace exposes contextual setup.

  const handleSkipWizard = () => {
    const skipKey = `horarios:wizard-skipped:${escolaId}`;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(skipKey, "true");
    }
    setShowWizard(false);
  };

  useEffect(() => {
    if (!autoDraftDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [autoDraftDirty]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    fetch(`/api/escolas/${escolaId}/nome`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.ok && json?.nome) setEscolaNome(json.nome);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [escolaId]);

  useEffect(() => {
    let active = true;
    fetch("/api/secretaria/professores?pageSize=200")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.ok && Array.isArray(json.items)) {
          setProfessores(
            json.items
              .map((item: any) => ({ id: item.user_id ?? item.id, nome: item.nome ?? "Professor" }))
              .filter((item: any) => Boolean(item.id))
          );
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!escolaId || !turmaId) return;
    setHorarioStatus("sem_horario");
    const key = `horarios:versao:${escolaId}:${turmaId}`;
    setVersaoId(null);
    setVersionError(null);
    setHasSavedDraft(false);
    let active = true;
    fetch(`/api/secretaria/turmas/${turmaId}/horario/versao?escola_id=${encodeURIComponent(escolaId)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Não foi possível consultar o horário.");
        const versaoPreferida = json.versao_edicao_id ?? json.versao_publicada_id ?? json.versao_id;
        if (["sem_horario", "rascunho", "publicado"].includes(json.horario_status)) {
          setHorarioStatus(json.horario_status as TimetablePublicationState);
        }
        setHasSavedDraft(Boolean(json.tem_rascunho_nao_publicado));
        if (versaoPreferida) {
          window.sessionStorage.setItem(key, versaoPreferida);
          setVersaoId(versaoPreferida);
        }
      })
      .catch((err) => {
        if (!active) return;
        setVersionError(err instanceof Error ? err.message : "Não foi possível consultar o horário.");
      });

    return () => {
      active = false;
    };
  }, [escolaId, turmaId]);

  useEffect(() => {
    if (turmas.length === 0) {
      setTurmaId(null);
      return;
    }
    const turmaIdFromQuery = searchParams?.get("turmaId") ?? null;
    if (!initialQueryApplied.current) {
      initialQueryApplied.current = true;
      if (turmaIdFromQuery && turmas.some((turma) => turma.id === turmaIdFromQuery)) setTurmaId(turmaIdFromQuery);
    }
  }, [searchParams, turmas]);

  const loadCurriculoDisciplinas = useCallback(async (targetCursoId: string, options?: { force?: boolean }) => {
    const cached = curriculoDataCacheRef.current.get(targetCursoId);
    if (cached && !options?.force) {
      setCurriculoClasses(cached.classes);
      setCurriculoDisciplinas(cached.disciplinas);
      setCurriculoSelectedId((prev) => {
        if (prev && cached.disciplinas.some((disc) => disc.id === prev)) return prev;
        return cached.disciplinas[0]?.id ?? null;
      });
      return cached.disciplinas;
    }

    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const parseClassNumber = (value: string) => {
      const match = value.match(/(\d{1,2})/);
      return match ? Number(match[1]) : null;
    };
    const currentTurmaClassId = turmas.find((turma) => turma.id === turmaId)?.classe_id ?? null;

    const [disciplinasJson, padroesJson] = await Promise.all([
      fetch(`/api/escolas/${escolaId}/disciplinas?curso_id=${targetCursoId}&limit=500`, {
        cache: "no-store",
      }).then((res) => res.json()),
      fetch(`/api/escolas/${escolaId}/curriculo/padroes?curso_id=${targetCursoId}`, {
        cache: "no-store",
      }).then((res) => res.json()),
    ]);

    const rows = Array.isArray(disciplinasJson?.data) ? disciplinasJson.data : [];
    const presetMap = new Map<string, number>();
    const presetItems = Array.isArray(padroesJson?.items) ? padroesJson.items : [];
    for (const item of presetItems) {
      const classNum = parseClassNumber(item.grade_level ?? "");
      if (!classNum) continue;
      const key = `${classNum}:${normalize(item.name ?? "")}`;
      presetMap.set(key, Number(item.weekly_hours) || 0);
    }

    const classMap = new Map<string, string>();
    rows.forEach((row: any) => {
      if (row.classe_id) {
        classMap.set(row.classe_id, row.classe_nome ?? row.classe_id);
      }
    });
    const classes = Array.from(classMap.entries()).map(([id, nome]) => ({ id, nome }));

    const disciplinaGroups = new Map<string, any[]>();
    rows.forEach((item: any) => {
      const key = item.disciplina_id ?? item.nome ?? item.id;
      const bucket = disciplinaGroups.get(key) ?? [];
      bucket.push(item);
      disciplinaGroups.set(key, bucket);
    });

    const statusWeight = (status?: string | null) => {
      if (status === "draft") return 3;
      if (status === "published") return 2;
      return 1;
    };

    const disciplinaList: CurriculoDisciplinaItem[] = [];
    disciplinaGroups.forEach((items) => {
      const preferredByClass = new Map<string, any>();
      items.forEach((item: any) => {
        const classKey = item.classe_id ?? "__no_class__";
        const current = preferredByClass.get(classKey);
        if (!current) {
          preferredByClass.set(classKey, item);
          return;
        }
        const currentWeight = statusWeight(current.curriculo_status);
        const nextWeight = statusWeight(item.curriculo_status);
        if (nextWeight > currentWeight) {
          preferredByClass.set(classKey, item);
        }
      });

      const preferredItems = Array.from(preferredByClass.values());
      const primary =
        preferredItems.find((item: any) => item.classe_id === currentTurmaClassId) ??
        preferredItems[0] ??
        items[0];
      const matrixIds = preferredItems.map((item: any) => item.id).filter(Boolean);
      const classIds = preferredItems.map((item: any) => item.classe_id).filter(Boolean);
      const matrixByClass: Record<string, string[]> = {};
      preferredItems.forEach((item: any) => {
        if (!item.classe_id || !item.id) return;
        matrixByClass[item.classe_id] = matrixByClass[item.classe_id] || [];
        matrixByClass[item.classe_id].push(item.id);
      });
      const classNum = parseClassNumber(primary.classe_nome ?? "");
      const baseKey = classNum ? `${classNum}:${normalize(primary.nome ?? "")}` : null;
      const baseWeeklyHours = baseKey ? presetMap.get(baseKey) ?? null : null;
      disciplinaList.push({
        id: primary.disciplina_id ?? primary.id,
        nome: primary.nome ?? "Disciplina",
        codigo: primary.sigla ?? primary.codigo ?? "",
        carga_horaria_semanal: primary.carga_horaria_semanal ?? 0,
        base_weekly_hours: baseWeeklyHours,
        classificacao: primary.classificacao ?? null,
        periodos_ativos: primary.periodos_ativos ?? null,
        entra_no_horario: primary.entra_no_horario ?? true,
        is_avaliavel: primary.is_avaliavel ?? true,
        conta_para_media_med: primary.conta_para_media_med ?? true,
        avaliacao_mode_key: primary.avaliacao_mode ?? null,
        avaliacao_disciplina_id: primary.avaliacao_disciplina_id ?? null,
        area: primary.area ?? null,
        is_core: primary.is_core ?? null,
        matrix_ids: matrixIds,
        class_ids: classIds,
        matrix_by_class: matrixByClass,
      });
    });

    disciplinaList.sort((a, b) => a.nome.localeCompare(b.nome));
    curriculoDataCacheRef.current.set(targetCursoId, { disciplinas: disciplinaList, classes });
    setCurriculoClasses(classes);
    setCurriculoDisciplinas(disciplinaList);
    setCurriculoSelectedId((prev) => {
      if (prev && disciplinaList.some((disc) => disc.id === prev)) return prev;
      return disciplinaList[0]?.id ?? null;
    });
    return disciplinaList;
  }, [escolaId, turmaId, turmas]);

  useEffect(() => {
    const targetCursoId = turmas.find((turma) => turma.id === turmaId)?.curso_id;
    if ((!curriculoModalOpen && !hasMissingLoadInAulas) || !targetCursoId || !escolaId) return;
    const timer = window.setTimeout(() => {
      loadCurriculoDisciplinas(targetCursoId).catch(() => null);
    }, curriculoModalOpen ? 0 : 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [curriculoModalOpen, escolaId, turmaId, turmas, hasMissingLoadInAulas, loadCurriculoDisciplinas]);

  const turmaOptions = useMemo(() => {
    if (turmas.length === 0) {
      return [{ value: "", label: "Sem turmas" }];
    }
    return [
      { value: "", label: "Selecione uma turma" },
      ...turmas.map((turma) => ({
        value: turma.id,
        label:
          turma.turma_codigo ||
          turma.turma_code ||
          turma.turma_nome ||
          turma.nome ||
          turma.id,
      })),
    ];
  }, [turmas]);



  const loadCurriculoStatus = useCallback(async () => {
    if (!escolaParam) return [] as CurriculoStatusItem[];
    const res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/status`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || "Falha ao carregar status do currículo.");
    }
    const rows = Array.isArray(json?.curriculos) ? json.curriculos : [];
    setCurriculoStatusRows(rows);
    return rows as CurriculoStatusItem[];
  }, [escolaParam]);

  useEffect(() => {
    if (!selectedTurma?.curso_id || !selectedTurma?.classe_id) return;
    loadCurriculoStatus().catch(() => null);
  }, [loadCurriculoStatus, selectedTurma?.classe_id, selectedTurma?.curso_id]);

  const selectedCurriculoStatus = useMemo(() => {
    if (!selectedTurma?.curso_id || !selectedTurma?.classe_id) return null;
    return curriculoStatusRows.find(
      (row) => row.curso_id === selectedTurma.curso_id && row.classe_id === selectedTurma.classe_id
    ) ?? null;
  }, [curriculoStatusRows, selectedTurma?.classe_id, selectedTurma?.curso_id]);

  const hasCurriculoDraft = selectedCurriculoStatus?.status === "draft";

  const aulasWithAllocations = useMemo(() => {
    if (!aulas.length) return [];
    const counts: Record<string, number> = {};
    for (const value of Object.values(grid)) {
      if (!value) continue;
      counts[value] = (counts[value] || 0) + 1;
    }
    return aulas.map((aula) => ({
      ...aula,
      temposAlocados: counts[aula.id] ?? 0,
    }));
  }, [aulas, grid]);

  const horariosDisponiveis = useMemo(() => (slots.length > 0 ? slots : undefined), [slots]);
  const missingLoad = useMemo(() => aulasWithAllocations.filter((aula) => aula.missingLoad), [aulasWithAllocations]);
  const missingLoadCount = missingLoad.length;
  const isLoading = baseLoading || turmaLoading;
  const showOfflineStatus = isMounted && !online;
  const totalDias = useMemo(() => {
    const unique = new Set(Object.keys(slotLookup).map((key) => key.split("-")[0]));
    return unique.size || 5;
  }, [slotLookup]);
  const temposAulaCount = useMemo(
    () => (horariosDisponiveis ?? []).filter((slot) => slot.tipo !== "intervalo").length,
    [horariosDisponiveis]
  );
  const totalSlots = Object.entries(slotLookup).filter(([key]) => (horariosDisponiveis ?? []).some((slot) => slot.tipo === "aula" && key.endsWith(`-${slot.id}`))).length;
  const filledSlots = useMemo(
    () => Object.values(grid).filter((value) => Boolean(value)).length,
    [grid]
  );
  const canPublicar = !isLoading && !baseError && !turmaError && !versionError && !!versaoId && online && !saving && !publishing && filledSlots > 0;
  const totalCarga = useMemo(
    () => aulasWithAllocations.reduce((acc, aula) => acc + (aula.temposTotal || 0), 0),
    [aulasWithAllocations]
  );
  const excessoCarga = Math.max(0, totalCarga - totalSlots);
  const allCurriculoAtMed = useMemo(
    () =>
      curriculoDisciplinas.length > 0 &&
      curriculoDisciplinas.every((disc) => {
        if (disc.base_weekly_hours === null || disc.base_weekly_hours === undefined) return true;
        return Number(disc.base_weekly_hours) === Number(disc.carga_horaria_semanal ?? 0);
      }),
    [curriculoDisciplinas]
  );
  useEffect(() => {
    const targetCursoId = selectedTurma?.curso_id;
    if (excessoCarga <= 0 || !targetCursoId || !escolaId) return;
    const timer = window.setTimeout(() => {
      loadCurriculoDisciplinas(targetCursoId).catch(() => null);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [escolaId, excessoCarga, loadCurriculoDisciplinas, selectedTurma?.curso_id]);
  const turnoLabel = useMemo(() => {
    const turno = selectedTurma?.turno?.toString().toUpperCase() ?? "";
    if (turno === "M") return "manhã";
    if (turno === "T") return "tarde";
    if (turno === "N") return "noite";
    return "turno";
  }, [selectedTurma?.turno]);
  const disciplinasCompletas = useMemo(
    () => aulasWithAllocations.filter((aula) => aula.temposAlocados > 0).length,
    [aulasWithAllocations]
  );
  const disciplinasPendentes = useMemo(
    () =>
      aulasWithAllocations.filter(
        (aula) => aula.missingLoad || aula.temposAlocados !== aula.temposTotal
      ),
    [aulasWithAllocations]
  );
  const conflitosCount = Object.keys(conflictSlots).length;
  const missingLoadSuggestions = useMemo(
    () =>
      missingLoad.map((aula) => {
        const curriculo = curriculoDisciplinas.find((disc) => disc.id === aula.id);
        return {
          ...aula,
          suggestedHours: curriculo?.base_weekly_hours ?? null,
          currentHours: curriculo?.carga_horaria_semanal ?? 0,
        };
      }),
    [curriculoDisciplinas, missingLoad]
  );
  const professorLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulasWithAllocations) {
      if (!aula.professorId) continue;
      const entry = map.get(aula.professorId) || {
        id: aula.professorId,
        nome: aula.professor || "Professor",
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.professorId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulasWithAllocations]);
  const salaLoad = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number }>();
    for (const aula of aulasWithAllocations) {
      if (!aula.salaId) continue;
      const sala = salas.find((item) => item.id === aula.salaId);
      const entry = map.get(aula.salaId) || {
        id: aula.salaId,
        nome: sala?.nome ?? `Sala ${aula.salaId.slice(0, 4)}`,
        count: 0,
      };
      entry.count += aula.temposAlocados;
      map.set(aula.salaId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [aulasWithAllocations, salas]);
  const overloadProfessores = professorLoad.filter((item) => item.count >= 16);
  const overloadSalas = salaLoad.filter((item) => item.count >= 20);

  const mapTurnoId = (turno?: string | null) => {
    const normalized = turno?.toString().toUpperCase();
    if (normalized === "M") return "matinal";
    if (normalized === "T") return "tarde";
    if (normalized === "N") return "noite";
    return "matinal";
  };

  const maxSlotsPerDayForTurno = useMemo(() => {
    const normalized = selectedTurma?.turno?.toString().toUpperCase() ?? "M";
    if (normalized === "N") return 7;
    return 8;
  }, [selectedTurma?.turno]);

  const requiredSlotsPerDay = useMemo(() => {
    if (totalDias <= 0) return temposAulaCount;
    return Math.max(temposAulaCount, Math.ceil(totalCarga / totalDias));
  }, [totalCarga, totalDias, temposAulaCount]);

  const targetSlotsPerDay = useMemo(
    () => Math.min(requiredSlotsPerDay, maxSlotsPerDayForTurno),
    [maxSlotsPerDayForTurno, requiredSlotsPerDay]
  );

  const canCompressSameTurn = targetSlotsPerDay > temposAulaCount;
  const compressionLimitReached = requiredSlotsPerDay > maxSlotsPerDayForTurno;
  const weeklyCapacityAfterCompression = totalDias * targetSlotsPerDay;
  const remainingOverflowAfterCompression = Math.max(0, totalCarga - weeklyCapacityAfterCompression);

  const handleAutoAdjustSlots = async () => {
    if (!escolaId || !selectedTurma) return;
    if (!canCompressSameTurn) return;
    try {
      setAdjustingSlots(true);
      const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`);
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao carregar slots.");
      }

      const slots = Array.isArray(json?.items) ? json.items : [];
      const turnoId = mapTurnoId(selectedTurma.turno ?? "M");
      const slotsDoTurno = slots.filter((slot: any) => slot.turno_id === turnoId);
      const slotsByDay = new Map<number, any[]>();
      slotsDoTurno.forEach((slot: any) => {
        const dia = Number(slot.dia_semana);
        if (!slotsByDay.has(dia)) slotsByDay.set(dia, []);
        slotsByDay.get(dia)!.push(slot);
      });

      const newSlots: Array<{
        turno_id: string;
        dia_semana: number;
        ordem: number;
        inicio: string;
        fim: string;
        is_intervalo: boolean;
      }> = [];

      slotsByDay.forEach((daySlots, day) => {
        const sorted = [...daySlots].sort((a, b) => a.ordem - b.ordem);
        const aulasExistentes = sorted.filter((slot) => !slot.is_intervalo).length;
        if (aulasExistentes >= targetSlotsPerDay) return;
        const lastSlot = sorted[sorted.length - 1];
        const [startH, startM] = String(lastSlot.inicio).split(":").map(Number);
        const [endH, endM] = String(lastSlot.fim).split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const duration = Math.max(30, endMinutes - startMinutes);
        let currentEnd = endMinutes;
        let currentOrder = Number(lastSlot.ordem);
        let remaining = targetSlotsPerDay - aulasExistentes;

        while (remaining > 0) {
          currentOrder += 1;
          const nextStart = currentEnd;
          const nextEnd = currentEnd + duration;
          const pad = (value: number) => String(value).padStart(2, "0");
          const inicio = `${pad(Math.floor(nextStart / 60))}:${pad(nextStart % 60)}`;
          const fim = `${pad(Math.floor(nextEnd / 60))}:${pad(nextEnd % 60)}`;
          newSlots.push({
            turno_id: turnoId,
            dia_semana: day,
            ordem: currentOrder,
            inicio,
            fim,
            is_intervalo: false,
          });
          currentEnd = nextEnd;
          remaining -= 1;
        }
      });

      if (newSlots.length === 0) {
        rawToast({ variant: "info", title: "Slots já estão no limite." });
        return;
      }

      const saveRes = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: newSlots }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok || saveJson?.ok === false) {
        throw new Error(formatSlotSaveError(saveJson));
      }

      success(`Slots ajustados para ${targetSlotsPerDay} aulas/dia no mesmo turno.`);
      if (Array.isArray(saveJson?.items)) {
        setRawSlots((prev) => {
          const merged = new Map(prev.map((slot) => [slot.id, slot]));
          for (const slot of saveJson.items) {
            if (!slot?.id) continue;
            merged.set(slot.id, slot);
          }
          return Array.from(merged.values());
        });
      } else {
        refreshBaseData();
      }
    } catch (e: any) {
      error(e?.message || "Falha ao ajustar slots.");
    } finally {
      setAdjustingSlots(false);
    }
  };

  const handleAddContraturno = async () => {
    if (!escolaId || !selectedTurma?.curso_id || !selectedTurma?.classe_id) return;
    const anoLetivo = selectedTurma.ano_letivo ?? new Date().getFullYear();
    try {
      setGeneratingContraturno(true);
      const res = await fetch(`/api/escola/${escolaParam}/admin/turmas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: selectedTurma.curso_id,
          anoLetivo,
          turnos: ["T"],
          classes: [{ classeId: selectedTurma.classe_id, quantidade: 1 }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao gerar turmas no contraturno.");
      }
      success("Turma de contraturno gerada.");
      refreshBaseData();
    } catch (e: any) {
      error(e?.message || "Falha ao gerar contraturno.");
    } finally {
      setGeneratingContraturno(false);
    }
  };

  const switchTurma = async (nextTurmaId: string | null) => {
    if (nextTurmaId === turmaId || saving || publishing || autoScheduling) return;
    if (autoDraftDirty && !(await confirm({ title: "Alterações por guardar", message: "Pretende sair sem guardar as alterações deste horário?", confirmLabel: "Sair sem guardar" }))) return;
    setAutoDraftDirty(false); setValidated(false); setUndoStack([]); setRedoStack([]);
    setAutoProposalSummary(null); setConflictSlots({}); setConflictReasons({}); setSaveError(null);
    setVersaoId(null); setHasSavedDraft(false); setVersionError(null); setHorarioStatus("sem_horario");
    setTurmaId(nextTurmaId);
  };
  const editGrid = (next: Record<string,string|null>) => {
    if (JSON.stringify(next) === JSON.stringify(grid)) return;
    setUndoStack(prev=>[...prev.slice(-49), {...grid}]); setRedoStack([]);
    setGrid(next); setConflictSlots({}); setConflictReasons({}); setValidated(false);
    setAutoDraftDirty(true); setAutoProposalSummary(null);
  };
  const undoGrid = () => {
    const previous = undoStack.at(-1); if (!previous) return;
    setUndoStack(prev=>prev.slice(0,-1)); setRedoStack(prev=>[...prev.slice(-49), {...grid}]);
    setGrid(previous); setConflictSlots({}); setConflictReasons({}); setValidated(false); setAutoDraftDirty(true); setAutoProposalSummary(null);
  };
  const redoGrid = () => {
    const next = redoStack.at(-1); if (!next) return;
    setRedoStack(prev=>prev.slice(0,-1)); setUndoStack(prev=>[...prev.slice(-49), {...grid}]);
    setGrid(next); setConflictSlots({}); setConflictReasons({}); setValidated(false); setAutoDraftDirty(true); setAutoProposalSummary(null);
  };

  const handleClearQuadro = async () => {
    if (!turmaId || !versaoId || saving || publishing) return;
    const ok = await confirm({title:"Limpar quadro em edição",message:"Os tempos serão limpos apenas no editor. O horário oficial mantém-se. Pode desfazer a operação.",confirmLabel:"Limpar quadro",variant:"danger"});
    if (ok) editGrid({});
  };

  const buildGridRows = () => {
    const rows: Array<{ tempo: string; values: string[] }> = [];
    const tempoLabels = (horariosDisponiveis ?? []).map((slot) => slot.labelDefault);
    const sortedTempos = (horariosDisponiveis ?? []).map((slot) => slot.id);
    const aulaById = new Map(aulas.map((aula) => [aula.id, aula]));

    sortedTempos.forEach((tempoId, index) => {
      const label = tempoLabels[index] ?? tempoId;
      const values = DIAS_SEMANA.map((dia) => {
        const key = `${dia}-${tempoId}`;
        const disciplinaId = grid[key];
        if (!disciplinaId) return "";
        const aula = aulaById.get(disciplinaId);
        return aula?.sigla || aula?.disciplina || "";
      });
      rows.push({ tempo: label, values });
    });

    return rows;
  };

  const handleDownloadPdf = async () => {
    if (!selectedTurma || !horariosDisponiveis || horariosDisponiveis.length === 0) {
      error("Selecione uma turma e configure os horários.");
      return;
    }

    try {
      setDownloadingPdf(true);
      await downloadHorarioTurmaPdf({ escolaId, turma: { id: selectedTurma.id } });
    } catch (e: any) {
      error(e?.message || "Falha ao gerar PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!selectedTurma || !horariosDisponiveis || horariosDisponiveis.length === 0) {
      error("Selecione uma turma e configure os horários.");
      return;
    }

    const rows = buildGridRows();
    const tableRows = rows
      .map(
        (row) =>
          `<tr><td>${row.tempo}</td>${row.values
            .map((value) => `<td>${value || ""}</td>`)
            .join("")}</tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <title>Quadro de Horários</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: center; }
            th { background: #f8fafc; }
            td:first-child { text-align: left; min-width: 90px; }
          </style>
        </head>
        <body>
          <h1>Quadro de Horários</h1>
          <div class="meta">${escolaNome || "Escola"} • ${selectedTurma?.curso?.nome ?? "Curso"} • ${selectedTurma?.classe?.nome ?? "Classe"} • ${selectedTurma?.turma_codigo || selectedTurma?.turma_nome || selectedTurma?.nome || "Turma"} • Turno ${turnoLabel}${selectedTurma?.sala ? ` • Sala ${selectedTurma.sala}` : ""}</div>
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                ${DIAS_SEMANA.map((dia) => `<th>${dia}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      error("Não foi possível abrir a janela de impressão.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const submitQuadro = async (
    nextGrid: Record<string, string | null>,
    mode: "draft" | "publish" | "validate",
    options?: { successTitle?: string; successMessage?: string }
  ): Promise<boolean> => {
    if (!escolaId || !turmaId || !versaoId || isLoading || baseError || turmaError || versionError || saving || publishing || !turnoId || !Object.keys(slotLookup).length) return false;
    if (Object.entries(nextGrid).some(([key, id]) => id && !slotLookup[key])) {
      error("Existem aulas fora dos tempos configurados. Recarregue antes de guardar.");
      return false;
    }
    if (mode !== "draft" && !Object.values(nextGrid).some(Boolean)) {
      error("Adicione pelo menos uma aula antes de publicar.");
      return false;
    }

    const anoLetivoId = selectedTurma?.ano_letivo_id ?? selectedTurma?.session_id ?? null;
    if (!anoLetivoId) {
      const message = "Não foi possível identificar o ano letivo desta turma. Recarregue a turma e tente novamente.";
      setSaveError(message);
      error("Contexto incompleto", message);
      return false;
    }

    if (mode === "draft") {
      setSaving(true);
    } else {
      setPublishing(true);
    }
    setSaveError(null);

    // The timetable has its own optional teacher attribution.
    // Never infer professor_id from academic turma-disciplina assignments:
    // doing so can prevent publishing an otherwise valid grid.
    const existingBySlotAndDiscipline = new Map(
      existingAssignments.map((item) => [`${item.slot_id}:${item.disciplina_id}`, item])
    );
    const items = Object.entries(nextGrid)
      .map(([slotKey, disciplinaId]) => ({ slotKey, disciplinaId }))
      .filter(({ slotKey, disciplinaId }) => disciplinaId && slotLookup[slotKey])
      .map(({ slotKey, disciplinaId }) => {
        const slotId = slotLookup[slotKey];
        const previous = existingBySlotAndDiscipline.get(`${slotId}:${disciplinaId}`);
        const salaId = selectedTurma?.sala
          ? salas.find((sala) => sala.nome === selectedTurma.sala)?.id ?? null
          : null;
        return {
          slot_id: slotId,
          disciplina_id: disciplinaId as string,
          professor_id: previous?.professor_id ?? null,
          sala_id: previous?.sala_id ?? salaId,
        };
      });

    const payload = {
      ano_letivo_id: anoLetivoId,
      versao_id: versaoId,
      turma_id: turmaId,
      items,
      mode,
    };

    setGrid(() => nextGrid);

    try {
      if (!online && mode === "draft") {
        await enqueueOfflineAction({
          url: `/api/escolas/${escolaId}/horarios/quadro`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          type: "horarios_quadro",
        });
        rawToast({
          variant: "info",
          title: "Quadro salvo no dispositivo.",
          message: "Sincronizaremos quando a conexão voltar.",
        });
        return true;
      }
      if (!online && mode !== "draft") {
        error("Modo offline: conecte-se para validar ou publicar o quadro.");
        return false;
      }

      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setValidated(false);
        setSaveError(json?.error || "Falha ao guardar ou validar o quadro");
        if (json?.conflicts && Array.isArray(json.conflicts)) {
          const nextConflicts: Record<string, boolean> = {};
          const nextReasons: Record<string, string[]> = {};
          for (const conflict of json.conflicts) {
            const slotKey = Object.entries(slotLookup).find(([, id]) => id === conflict.slot_id)?.[0];
            if (slotKey) {
              nextConflicts[slotKey] = true;
              const reason = conflict.kind === "professor" ? "Professor ocupado" : conflict.kind === "sala" ? "Sala ocupada" : "Turma já possui aula neste tempo";
              nextReasons[slotKey] = Array.from(new Set([...(nextReasons[slotKey] ?? []), reason]));
            }
          }
          setConflictSlots(nextConflicts);
          setConflictReasons(nextReasons);
          const reasons = Array.from(new Set(Object.values(nextReasons).flat()));
          error(
            "Conflito de horário",
            `${json.conflicts.length} slot(s) em conflito${reasons.length ? `: ${reasons.join(", ")}` : "."} Os horários foram destacados.`
          );
        }
        if (json?.details?.missing?.length) {
          const nomes = json.details.missing
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          error("Cargas horárias pendentes", nomes.length ? nomes.join(", ") : json?.error);
        }
        if (json?.details?.mismatch?.length) {
          const nomes = json.details.mismatch
            .map((item: any) => item.disciplina || item.disciplina_nome)
            .filter(Boolean);
          error("Distribuição incompleta", nomes.length ? nomes.join(", ") : json?.error);
        }
        return false;
      }

      setConflictSlots({});
      setConflictReasons({});
      if (mode === "validate") { setValidated(true); success("Validação concluída", "Nenhum conflito identificado neste momento. A publicação valida novamente."); return true; }
      setAutoDraftDirty(false);
      const persistedVersion = json?.versao_id;
      if (typeof persistedVersion === "string") {
        setVersaoId(persistedVersion);
        window.sessionStorage.setItem(`horarios:versao:${escolaId}:${turmaId}`, persistedVersion);
      }
      setHasSavedDraft(mode === "draft" && horarioStatus === "publicado");
      const nextStatus = mode === "publish" || horarioStatus === "publicado" ? "publicado" : "rascunho";
      setHorarioStatus(nextStatus);
      setTurmas(prev=>prev.map(t=>t.id===turmaId?{...t,horario_status:nextStatus}:t));
      setValidated(mode === "publish"); setUndoStack([]); setRedoStack([]);
      setAutoProposalSummary(null);
      if (mode === "publish" && Array.isArray(json?.warnings) && json.warnings.length > 0) {
        const publishWarnings = json.warnings as PublishWarning[];
        const warningDetails = publishWarnings
          .map((item) => {
            const count = Array.isArray(item?.details) ? item.details.length : 0;
            if (item?.code === "CARGA_HORARIA_MISSING") return `${count} disciplina(s) sem carga`;
            if (item?.code === "CARGA_HORARIA_MISMATCH") return `${count} disciplina(s) com distribuição divergente`;
            return item?.message || "Pendência no quadro";
          })
          .join(" | ");
        warning(
          "Referência curricular — informativo",
          warningDetails || "O horário foi publicado. A comparação curricular é informativa."
        );
      }
      success(
        options?.successTitle ?? (mode === "publish" ? "Quadro publicado." : "Quadro salvo."),
        options?.successMessage
          ?? (mode === "publish"
            ? "Horário disponível para consulta."
            : "Rascunho guardado. O horário publicado não foi alterado.")
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar quadro";
      setSaveError(message);
      error(message);
      return false;
    } finally {
      if (mode === "draft") {
        setSaving(false);
      } else {
        setPublishing(false);
      }
    }
  };

  const handleSalvar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "draft");
  const handlePublicar = async (nextGrid: Record<string, string | null>) => {
    if (!(await confirm({title: "Publicar horário?",message: "O horário em edição ficará disponível para consulta nos portais. O horário oficial anterior será substituído apenas se a validação passar.",confirmLabel: "Publicar horário"}))) return;
    await submitQuadro(nextGrid, "publish");
  };

  const handleAutoConfigurar = async (options?: { rerunAutoComplete?: boolean }) => {
    if (!escolaId || !turmaId) return;
    setAutoConfiguring(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/horarios/cargas/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId, strategy: "preset_then_default", overwrite: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        success("Cargas preenchidas", `${json?.data?.updated ?? 0} disciplina(s) atualizadas.`);
        if (selectedTurma?.curso_id) {
          await loadCurriculoDisciplinas(selectedTurma.curso_id, { force: true }).catch(() => null);
        }
        refreshTurmaData();
        if (options?.rerunAutoComplete) {
          await handleAutoCompletar();
        }
      } else {
        error(json?.error || "Falha ao configurar cargas");
      }
    } finally {
      setAutoConfiguring(false);
    }
  };

  const handleRevertAllToStandard = async () => {
    if (!escolaId || !selectedTurma?.curso_id) return;

    setRevertingAll(true);
    try {
      const sourceDisciplinas = curriculoDisciplinas.length > 0
        ? curriculoDisciplinas
        : await loadCurriculoDisciplinas(selectedTurma.curso_id);
      const mismatches = sourceDisciplinas.filter(
        (disc) => disc.base_weekly_hours !== null && disc.base_weekly_hours !== disc.carga_horaria_semanal
      );

      if (mismatches.length === 0) {
        success("Tudo em ordem", "Todas as disciplinas já estão no padrão do MED.");
        return;
      }

      await Promise.all(
        mismatches.flatMap((disc) =>
          disc.matrix_ids.map(async (matrixId) => {
            const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                carga_horaria_semanal: disc.base_weekly_hours,
                carga_horaria: disc.base_weekly_hours,
              }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || `Falha ao atualizar ${disc.nome}.`);
            }
          })
        )
      );

      success("Currículo atualizado", "Todas as disciplinas foram redefinidas para o padrão do MED.");
      const loadByDisciplina = new Map<string, number>(
        mismatches
          .filter((disc) => typeof disc.base_weekly_hours === "number")
          .map((disc) => [disc.id, Number(disc.base_weekly_hours)])
      );
      setAulas((prev) =>
        prev.map((aula) => {
          const nextLoad = loadByDisciplina.get(aula.id);
          return nextLoad === undefined
            ? aula
            : { ...aula, temposTotal: nextLoad, missingLoad: nextLoad <= 0 };
        })
      );
      if (selectedCurriculoStatus) {
        setCurriculoStatusRows((prev) =>
          prev.map((row) =>
            row.id === selectedCurriculoStatus.id ? { ...row, status: "draft" } : row
          )
        );
      }
      await loadCurriculoDisciplinas(selectedTurma.curso_id, { force: true }).catch(() => null);
      refreshTurmaData();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao redefinir disciplinas.");
    } finally {
      setRevertingAll(false);
    }
  };

  const handlePublishCurriculo = async () => {
    if (!escolaParam || !selectedCurriculoStatus) return;
    setPublishingCurriculo(true);
    try {
      const buildPublishBody = (confirmNoRebuildWithExistingTurmas: boolean) => ({
        cursoId: selectedCurriculoStatus.curso_id,
        anoLetivoId: selectedCurriculoStatus.ano_letivo_id,
        version: selectedCurriculoStatus.version,
        rebuildTurmas: false,
        confirmNoRebuildWithExistingTurmas,
        bulk: true,
      });

      let res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPublishBody(false)),
      });
      let json = await res.json().catch(() => null);
      if (json?.code === "CURRICULO_REBUILD_CONFIRM_REQUIRED") {
        const confirmed = await confirm({
          title: "Publicar sem reconstruir turmas",
          message: "Existem turmas já criadas para este curso. A publicação irá sincronizar as disciplinas sem reconstruí-las. Deseja continuar?",
          confirmLabel: "Sincronizar",
        });
        if (!confirmed) return;
        res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPublishBody(true)),
        });
        json = await res.json().catch(() => null);
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao publicar currículo.");
      }

      success("Currículo publicado com sucesso!");
      await loadCurriculoStatus().catch(() => null);
      refreshTurmaData();
    } catch (e: any) {
      error(e?.message || "Erro ao publicar currículo.");
    } finally {
      setPublishingCurriculo(false);
    }
  };

  const openCurriculoForDisciplina = (disciplinaId: string) => {
    setCurriculoSelectedId(disciplinaId);
    setCurriculoModalOpen(true);
  };

  const handleAutoCompletar = async () => {
    if (!escolaId || !turmaId || isLoading || saving || publishing || autoScheduling) return;
    if (filledSlots >= totalSlots) { success("Quadro preenchido", "Não existem tempos livres."); return; }
    const currentItems = Object.entries(grid).flatMap(([key,disciplina_id]) => {
      if (!disciplina_id || !slotLookup[key]) return [];
      const previous = existingAssignments.find(a=>a.slot_id===slotLookup[key]&&a.disciplina_id===disciplina_id);
      return [{slot_id:slotLookup[key],disciplina_id,professor_id:previous?.professor_id??null,sala_id:previous?.sala_id??null}];
    });
    setAutoScheduling(true);
    try {
      const turnoId = selectedTurma ? mapTurnoId(selectedTurma.turno ?? "M") : undefined;
      const res = await fetch(`/api/escolas/${escolaId}/horarios/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turmaId,
          turno: turnoId,
          strategy: "v1",
          overwrite_unlocked: false,
          current_items: currentItems,
          dry_run: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao auto-completar o quadro");
        return;
      }

      const reverseLookup: Record<string, string> = {};
      for (const [key, id] of Object.entries(slotLookup)) {
        reverseLookup[id] = key;
      }

      const nextGrid: Record<string, string | null> = {...grid};
      const allowed = new Set(aulas.map(aula=>aula.id));
      for (const assignment of json.assignments || []) {
        const slotKey = reverseLookup[assignment.slot_id];
        if (!slotKey || nextGrid[slotKey] || !allowed.has(assignment.disciplina_id)) continue;
        nextGrid[slotKey] = assignment.disciplina_id;
      }

      const added = Object.values(nextGrid).filter(Boolean).length - filledSlots;
      if (!added) { warning("Nenhum tempo preenchido", "Não foi encontrada uma sugestão adicional. Pode continuar manualmente."); return; }
      editGrid(nextGrid);
      setAutoProposalSummary({
        filled: Object.values(nextGrid).filter(Boolean).length,
        total: totalSlots,
        unmet: Array.isArray(json?.unmet) ? json.unmet.length : 0,
      });
      success(`${added} tempo(s) preenchido(s)`, "As aulas já distribuídas foram preservadas. Nada foi guardado ainda.");
      if (Array.isArray(json?.unmet) && json.unmet.length > 0) {
        const reasonLabel = (reason: string) => {
          switch (reason) {
            case "PROF_TURNO":
              return "Sem professor disponível no turno"
            case "SEM_PROF":
              return "Sem professor"
            case "SEM_SLOTS":
              return "Sem slots livres"
            case "CONFLITO_PROF":
              return "Conflito de professor"
            case "CONFLITO_SALA":
              return "Conflito de sala"
            case "REGRAS":
              return "Regras de distribuição"
            default:
              return reason
          }
        }
        const unmetDetails = json.unmet
          .map((item: any) => `${item.disciplina_nome || item.disciplina_id}: ${reasonLabel(item.reason)}`)
          .slice(0, 6)
        error("Pendências no auto-completar", unmetDetails.join(" | "))
      }
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleAssignProfessor = async (aula: (typeof aulas)[number], professorUserId: string) => {
    if (!turmaId || saving || publishing || autoScheduling) return;
    if (autoDraftDirty) { warning("Guarde o rascunho primeiro", "A atribuição docente recarrega os vínculos. As suas alterações serão preservadas."); return; }
    if (!aula?.cursoMatrizId) {
      error("Disciplina sem vínculo de currículo.");
      return;
    }
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/atribuir-professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curso_matriz_id: aula.cursoMatrizId,
          disciplina_id: aula.id,
          professor_user_id: professorUserId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao atribuir professor.");
      }
      success("Professor atribuído.");
      refreshTurmaData();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atribuir professor.");
    }
  };

  const handleAssignTurmaSala = async (salaId: string) => {
    if (!escolaId || !turmaId || saving || publishing || autoScheduling) return;
    if (autoDraftDirty) { warning("Guarde o rascunho primeiro", "A configuração da sala recarrega os dados da turma."); return; }
    const sala = salas.find((item) => item.id === salaId);
    if (!sala) {
      error("Sala não encontrada.");
      return;
    }
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas/${turmaId}/sala`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sala: sala.nome }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao atribuir sala.");
      }
      success("Sala atribuída à turma.");
      setTurmas((prev) =>
        prev.map((turma) =>
          turma.id === turmaId ? { ...turma, sala: sala.nome } : turma
        )
      );
      refreshTurmaData();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atribuir sala.");
    }
  };

  const handleSaveCurriculoDisciplina = async (payload: DisciplinaForm) => {
    if (!escolaId) return;
    const target = curriculoDisciplinas.find((disc) => disc.id === payload.id);
    if (!target) return;
    let matrixIds = target.matrix_ids ?? [];
    if (payload.apply_scope === "selected" && payload.class_ids?.length) {
      matrixIds = payload.class_ids.flatMap(
        (classId) => target.matrix_by_class?.[classId] ?? []
      );
    }
    if (matrixIds.length === 0) return;
    try {
      await Promise.all(
        matrixIds.map(async (matrixId) => {
          const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: payload.nome,
              sigla: payload.codigo,
              carga_horaria_semanal: payload.carga_horaria_semanal,
              carga_horaria: payload.carga_horaria_semanal,
              classificacao: payload.classificacao,
              is_avaliavel: true,
              area: payload.area ?? null,
              periodos_ativos: payload.periodos_ativos,
              entra_no_horario: payload.entra_no_horario,
              avaliacao_mode: payload.avaliacao.mode,
              avaliacao_modelo_id: null,
              avaliacao_disciplina_id:
                payload.avaliacao.mode === "inherit_disciplina"
                  ? payload.avaliacao.base_id ?? null
                  : null,
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao atualizar disciplina.");
          }
        })
      );

      success("Disciplina atualizada.");
      if (selectedCurriculoStatus) {
        setCurriculoStatusRows((prev) =>
          prev.map((row) =>
            row.id === selectedCurriculoStatus.id ? { ...row, status: "draft" } : row
          )
        );
      }
      setCurriculoModalOpen(false);
      if (selectedTurma?.curso_id) {
        await loadCurriculoDisciplinas(selectedTurma.curso_id, { force: true }).catch(() => null);
      }
      refreshTurmaData();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao atualizar disciplina.");
    }
  };

  const handleQuickSaveCurriculoDisciplina = async (payload: DisciplinaForm) => {
    if (!escolaId) return;
    const target = curriculoDisciplinas.find((disc) => disc.id === payload.id);
    if (!target) return;
    let matrixIds = target.matrix_ids ?? [];
    if (payload.apply_scope === "selected" && payload.class_ids?.length) {
      matrixIds = payload.class_ids.flatMap(
        (classId) => target.matrix_by_class?.[classId] ?? []
      );
    }
    if (matrixIds.length === 0) return;
    try {
      await Promise.all(
        matrixIds.map(async (matrixId) => {
          const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              carga_horaria_semanal: payload.carga_horaria_semanal,
              carga_horaria: payload.carga_horaria_semanal,
              periodos_ativos: payload.periodos_ativos,
              entra_no_horario: payload.entra_no_horario,
              conta_para_media_med: payload.conta_para_media_med ?? true,
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao salvar carga da disciplina.");
          }
        })
      );

      success("Carga da disciplina salva.");
      const nextLoad = payload.carga_horaria_semanal ?? 0;
      setAulas((prev) =>
        prev.map((aula) =>
          aula.id === target.id
            ? { ...aula, temposTotal: nextLoad, missingLoad: nextLoad <= 0 }
            : aula
        )
      );
      if (selectedCurriculoStatus) {
        setCurriculoStatusRows((prev) =>
          prev.map((row) =>
            row.id === selectedCurriculoStatus.id ? { ...row, status: "draft" } : row
          )
        );
      }
      setCurriculoModalOpen(false);
      if (selectedTurma?.curso_id) {
        await loadCurriculoDisciplinas(selectedTurma.curso_id, { force: true }).catch(() => null);
      }
      refreshTurmaData();
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao salvar carga da disciplina.");
    }
  };

  const applySuggestedLoad = async (
    disciplinaId: string,
    suggestedHours: number | null,
    options?: { rerunAutoComplete?: boolean }
  ) => {
    if (!suggestedHours || suggestedHours <= 0) {
      openCurriculoForDisciplina(disciplinaId);
      return;
    }
    const target = curriculoDisciplinas.find((disc) => disc.id === disciplinaId);
    if (!target) {
      openCurriculoForDisciplina(disciplinaId);
      return;
    }

    await handleSaveCurriculoDisciplina({
      id: target.id,
      nome: target.nome,
      codigo: target.codigo,
      carga_horaria_semanal: suggestedHours,
      classificacao: target.classificacao ?? (target.is_core ? "core" : "complementar"),
      entra_no_horario: target.entra_no_horario ?? true,
      is_avaliavel: target.is_avaliavel ?? true,
      conta_para_media_med: target.conta_para_media_med ?? true,
      avaliacao: {
        mode: target.avaliacao_mode_key ?? "inherit_school",
        base_id: target.avaliacao_disciplina_id ?? null,
      },
      area: target.area ?? null,
      programa_texto: null,
      periodos_ativos: target.periodos_ativos?.length ? target.periodos_ativos : [1, 2, 3],
      periodo_mode: target.periodos_ativos?.length ? "custom" : "ano",
      class_ids: target.class_ids ?? [],
      apply_scope: "all",
    });
    if (options?.rerunAutoComplete) {
      await handleAutoCompletar();
    }
  };

  const handleAddSala = async (nome: string) => {
    if (!nome.trim() || !escolaId) return;
    const res = await fetch(`/api/escolas/${escolaId}/salas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.item) {
      setSalas((prev) => [...prev, json.item]);
      success("Sala adicionada.");
      return;
    }
    error(json?.error || "Falha ao adicionar sala.");
  };

  if (isLoading && !turmaId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center text-muted-foreground">
        <Spinner className="text-amber" size={24} />
        <span className="ml-3 text-sm">Carregando quadro...</span>
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="min-h-screen bg-muted py-12 px-4 flex flex-col items-center">
        <div className="w-full max-w-6xl">
          <div className="mb-8 flex justify-between items-center">
            <Link href={dashboardHref} className="text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
              ← Voltar ao Dashboard
            </Link>
            <Button variant="ghost" onClick={handleSkipWizard} className="text-muted-foreground font-bold">
              Fechar
            </Button>
          </div>
          <HorarioWizard 
            escolaId={escolaId} 
            onFinish={() => {
              handleSkipWizard(); // Também salva que terminou para não reabrir
              refreshBaseData();
              refreshTurmaData();
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-muted text-foreground font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            {turmaId && <button type="button" onClick={()=>void switchTurma(null)} disabled={saving||publishing||autoScheduling} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"><ArrowLeft size={16}/> Todas as turmas</button>}
            <div className="flex items-center gap-2 rounded-full bg-muted p-1">
              <Link
                href={slotsHref}
                onClick={e=>{if(autoDraftDirty){e.preventDefault();warning("Guarde o rascunho primeiro","As alterações do quadro devem ser guardadas antes de configurar tempos.");}}}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Tempos
              </Link>
              <Link
                href={quadroHref}
                className="rounded-full bg-klasse-gold px-4 py-1.5 text-xs font-semibold text-klasse-gold-900 hover:brightness-95"
              >
                Quadro
              </Link>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => { if (!autoDraftDirty || await confirm({title:"Alterações por guardar",message:"Guarde o horário antes de alterar a estrutura dos tempos. Pretende continuar sem guardar?",confirmLabel:"Continuar sem guardar"})) { setAutoDraftDirty(false); setShowWizard(true); } }} 
              className="rounded-full gap-2 text-[10px] font-black uppercase tracking-widest border-2 border-border h-9"
            >
              <Wand2 className="w-3.5 h-3.5" /> Configurar base
            </Button>
            <Select
              value={turmaId ?? ""}
              options={turmaOptions}
              disabled={saving || publishing || autoScheduling}
              onChange={(event) => void switchTurma(event.target.value || null)}
              className="max-w-xs rounded-xl border-border focus:border-amber focus:ring-amber text-foreground"
            />            {selectedTurma?.sala ? (
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {selectedTurma.sala}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || horarioStatus !== "publicado" || !turmaId}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              {downloadingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={horarioStatus !== "publicado" || !turmaId}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Printer className="h-3 w-3" />
              Imprimir
            </button>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner size={14} className="text-amber" />
                Sincronizando dados...
              </div>
            ) : null}
            {showOfflineStatus ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <WifiOff className="h-3 w-3" />
                Modo offline
              </div>
            ) : null}
            {baseError ? <span className="text-xs text-rose-600">{baseError}</span> : null}
            {turmaError ? <span className="text-xs text-rose-600">{turmaError}</span> : null}
            {versionError ? <span role="alert" className="text-xs text-rose-600">{versionError}</span> : null}
            {hasSavedDraft && <span className="text-xs font-semibold text-muted-foreground">Rascunho guardado · aguarda publicação</span>}
            {turmaId && (
              <span role="status" className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
                {timetableStateLabels[horarioStatus]}
              </span>
            )}
            {saveError ? <span className="text-xs text-rose-600">{saveError}</span> : null}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Save className={`h-4 w-4 ${saving ? "text-amber" : "text-muted-foreground"}`} />
              <span>
                {saving ? "A guardar..." : autoDraftDirty ? "Alterações por guardar" : "Sem alterações locais"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {turmaId && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tempos programados</p>
              <p className="mt-1 text-xl font-bold text-foreground">{filledSlots}/{totalSlots}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Disciplinas no quadro</p>
              <p className="mt-1 text-xl font-bold text-foreground">{disciplinasCompletas}/{aulas.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Validação de conflitos</p>
              <p className={`mt-1 text-xl font-bold ${conflitosCount ? "text-rose-600" : "text-foreground"}`}>{conflitosCount > 0 ? conflitosCount : validated ? "Sem conflitos" : "Por validar"}</p>
            </div>
          </div>
        )}
        {turmaId && !isLoading && !Object.keys(slotLookup).length && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Ainda não existem tempos para o turno desta turma.</p>
            <Link href={slotsHref} className="mt-2 inline-block font-semibold underline">Configurar tempos do turno</Link>
          </div>
        )}
        {autoDraftDirty && turmaId && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">Alterações por guardar.</div>
            <div className="mt-1">Revise o quadro, ajuste manualmente se necessário e só depois salve ou publique.</div>
            {autoProposalSummary && <div className="mt-2 text-xs font-semibold">{autoProposalSummary.filled} de {autoProposalSummary.total} posições preenchidas{autoProposalSummary.unmet ? ` · ${autoProposalSummary.unmet} pendência(s)` : ""}.</div>}

          </div>
        )}
        {!turmaId ? (
          <HorariosWorkspace turmas={turmas} loading={baseLoading} error={baseError} onOpen={(id)=>void switchTurma(id)} onRefresh={refreshBaseData}/>
        ) : (
          <>
          <div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" disabled={!canPublicar||autoScheduling} onClick={()=>void submitQuadro(grid,"validate")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold disabled:opacity-40"><CheckCircle2 size={16}/> Validar conflitos</button><button type="button" disabled={!undoStack.length||saving||publishing||autoScheduling} onClick={undoGrid} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm disabled:opacity-40"><Undo2 size={16}/> Desfazer</button><button type="button" disabled={!redoStack.length||saving||publishing||autoScheduling} onClick={redoGrid} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm disabled:opacity-40"><Redo2 size={16}/> Refazer</button><button type="button" disabled={!filledSlots||saving||publishing||autoScheduling} onClick={handleClearQuadro} className="rounded-xl border border-border bg-card px-3 py-2 text-sm disabled:opacity-40">Limpar edição</button></div>
          <SchedulerBoard
            diasSemana={DIAS_SEMANA}
            tempos={horariosDisponiveis}
            aulas={aulasWithAllocations}
            onSalvar={handleSalvar}
            grid={grid}
            onGridChange={editGrid}
            slotLookup={slotLookup}
            existingAssignments={existingAssignments}
            conflictSlots={conflictSlots}
            conflictReasons={conflictReasons}
            salas={salas}
            professores={professores}
            onAssignProfessor={autoDraftDirty ? undefined : handleAssignProfessor}
            turmaSala={selectedTurma?.sala ?? null}
            onAssignTurmaSala={autoDraftDirty ? undefined : handleAssignTurmaSala}
            onAutoCompletar={handleAutoCompletar}
            autoCompleting={autoScheduling}
            onPublicar={handlePublicar}
            canPublicar={canPublicar}
            publishDisabledReason={filledSlots === 0 ? "Adicione pelo menos uma aula." : "Aguarde os dados ou verifique a ligação."}
            publishing={publishing}
            busy={isLoading || !!baseError || !!turmaError || !!versionError || !versaoId || saving || publishing || autoScheduling}
          />
          </>
        )}

        {turmaId && (
          <details className="mt-4 rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Planeamento curricular (opcional)</summary>
            {autoDraftDirty && <p className="mt-2 text-sm text-muted-foreground">Guarde o rascunho antes de efectuar alterações ao currículo.</p>}
            <fieldset disabled={autoDraftDirty || saving || publishing || autoScheduling}>
            <p className="mt-2 mb-4 text-sm text-muted-foreground">Os tempos programados são calculados pelo quadro. As referências curriculares não impedem a publicação; só altere o currículo se a escola decidir fazê-lo.</p>
                    {turmaId && excessoCarga > 0 && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Referência curricular acima da capacidade do turno</p>
            <p className="text-xs text-rose-700 mt-1">
              A carga semanal do curso é {totalCarga} e o turno da {turnoLabel} suporta {totalSlots}.
            </p>
            {allCurriculoAtMed ? (
              <p className="text-xs text-rose-700 mt-1">
                O currículo já está no padrão MED. Se a escola pretender cumprir esta referência, pode rever os tempos do turno.
              </p>
            ) : (
              <p className="text-xs text-rose-700 mt-1">
                Compare a referência curricular com o horário praticado pela escola antes de efectuar alterações.
              </p>
            )}
            <p className="text-[11px] text-rose-600 mt-2">
              Capacidade do turno = número de aulas úteis por semana. Carga vem do currículo publicado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTurma?.curso_id && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurriculoModalOpen(true)}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
                  >
                    Corrigir carga no currículo
                  </button>
                  {!allCurriculoAtMed ? (
                    <button
                      type="button"
                      onClick={handleRevertAllToStandard}
                      disabled={revertingAll}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {revertingAll ? "Corrigindo..." : "Corrigir cargas automaticamente (Padrão MED)"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleAutoAdjustSlots}
                        disabled={adjustingSlots || !canCompressSameTurn}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-all disabled:opacity-50"
                      >
                        {adjustingSlots ? "Ajustando..." : `Comprimir no mesmo turno (${targetSlotsPerDay}/dia)`}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {allCurriculoAtMed && (
              <div className="mt-3 space-y-1 text-[11px] text-rose-700">
                <p>
                  Meta de compressão deste turno: até {maxSlotsPerDayForTurno} tempos/dia.
                  {canCompressSameTurn ? ` O quadro pode subir de ${temposAulaCount} para ${targetSlotsPerDay} tempos/dia.` : " O turno já está nesse limite."}
                </p>
                {compressionLimitReached && (
                  <p>
                    Mesmo no limite, ainda faltarão {remainingOverflowAfterCompression} tempo(s) por semana. Nesse cenário, o problema deixa de ser UI e passa a ser capacidade real da grade.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {turmaId && disciplinasPendentes.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Comparação com a referência curricular</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {disciplinasPendentes.slice(0, 6).map((disc) => (
                <span
                  key={disc.id}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {disc.disciplina} {disc.temposAlocados}/{disc.temposTotal || "?"}
                </span>
              ))}
              {disciplinasPendentes.length > 6 && (
                <span className="text-xs text-muted-foreground">+{disciplinasPendentes.length - 6} mais</span>
              )}
            </div>
          </div>
        )}
        {turmaId && (overloadProfessores.length > 0 || overloadSalas.length > 0) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Tempos programados por recurso</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overloadProfessores.map((prof) => (
                <span
                  key={`prof-${prof.id}`}
                  className="rounded-full border border-rose-200 bg-card px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {prof.nome}: {prof.count} tempos
                </span>
              ))}
              {overloadSalas.map((sala) => (
                <span
                  key={`sala-${sala.id}`}
                  className="rounded-full border border-rose-200 bg-card px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {sala.nome}: {sala.count} tempos
                </span>
              ))}
            </div>
          </div>
        )}
        {missingLoadCount > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">{missingLoadCount} disciplina(s) sem carga horária.</div>
            <div className="mt-1">A configuração da carga é opcional para publicar o horário.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAutoConfigurar({ rerunAutoComplete: true })}
                disabled={autoConfiguring}
                className="rounded-lg bg-amber px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {autoConfiguring ? "Ajustando..." : "Configurar referências e sugerir distribuição"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {missingLoadSuggestions.slice(0, 6).map((disc) => (
                <div
                  key={disc.id}
                  className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-card/80 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-foreground">{disc.disciplina}</div>
                    <div className="text-xs text-muted-foreground">
                      {disc.suggestedHours && disc.suggestedHours > 0
                        ? `Sugestão MED: ${disc.suggestedHours} aula(s)/semana`
                        : "Sem MED encontrada. Ajuste manualmente."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {disc.suggestedHours && disc.suggestedHours > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          applySuggestedLoad(disc.id, disc.suggestedHours, { rerunAutoComplete: true })
                        }
                        className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900"
                      >
                        Usar MED {disc.suggestedHours}h e redistribuir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openCurriculoForDisciplina(disc.id)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
              {missingLoadSuggestions.length > 6 && (
                <div className="text-xs text-muted-foreground">
                  +{missingLoadSuggestions.length - 6} disciplina(s) com pendência. Use o modal para revisar o restante.
                </div>
              )}
            </div>
          </div>
        )}
        {hasCurriculoDraft && turmaId && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-semibold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Alterações de currículo salvas em rascunho
              </div>
              <div className="mt-1 text-emerald-700">
                Os ajustes de carga horária estão em rascunho. Publique o currículo para aplicá-los oficialmente a todas as turmas.
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={handlePublishCurriculo}
                disabled={publishingCurriculo}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {publishingCurriculo ? "Publicando..." : "Publicar Currículo"}
              </button>
            </div>
          </div>
        )}

            </fieldset>
          </details>
        )}

        {turmaId ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Adicionar sala"
              value={novaSala}
              onChange={(event) => setNovaSala(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 w-52 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-amber focus:ring-1 focus:ring-amber"
            />
            <button
              type="button"
              onClick={() => {
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 rounded-xl bg-amber px-4 text-sm font-semibold text-foreground shadow-sm"
            >
              Adicionar sala
            </button>

          </div>
        ) : null}
      </div>
      </div>
      {curriculoModalOpen && selectedTurma?.curso_id && (
        <DisciplinaModal
          open={curriculoModalOpen}
          mode="edit"
          initial={(() => {
            const disciplina = curriculoDisciplinas.find((d) => d.id === curriculoSelectedId);
            if (!disciplina) return null;
            return {
              id: disciplina.id,
              nome: disciplina.nome,
              codigo: disciplina.codigo,
              periodos_ativos: disciplina.periodos_ativos?.length
                ? disciplina.periodos_ativos
                : [1, 2, 3],
              periodo_mode: disciplina.periodos_ativos?.length ? "custom" : "ano",
              carga_horaria_semanal: disciplina.carga_horaria_semanal,
              classificacao: disciplina.classificacao ?? (disciplina.is_core ? "core" : "complementar"),
              entra_no_horario: disciplina.entra_no_horario ?? true,
              is_avaliavel: disciplina.is_avaliavel ?? true,
              conta_para_media_med: disciplina.conta_para_media_med ?? true,
              avaliacao: {
                mode: disciplina.avaliacao_mode_key ?? "inherit_school",
                base_id: disciplina.avaliacao_disciplina_id ?? null,
              },
              area: disciplina.area ?? null,
              programa_texto: null,
              class_ids: disciplina.class_ids ?? [],
            };
          })()}
          existingCodes={curriculoDisciplinas.map((d) => d.codigo)}
          existingNames={curriculoDisciplinas.map((d) => d.nome)}
          existingDisciplines={curriculoDisciplinas.map((d) => ({ id: d.id, nome: d.nome, codigo: d.codigo }))}
          classOptions={curriculoClasses}
          disciplineSelector={{
            label: "Disciplina do currículo",
            value: curriculoSelectedId ?? undefined,
            options: curriculoDisciplinas.map((d) => {
              const base = d.base_weekly_hours;
              const isOut = base && base !== d.carga_horaria_semanal;
              return {
                id: d.id,
                nome: d.nome,
                label: isOut ? `⚠ ${d.nome} (MED ${base})` : d.nome,
              };
            }),
            onChange: (id) => setCurriculoSelectedId(id),
          }}
          standardInfo={(() => {
            const disciplina = curriculoDisciplinas.find((d) => d.id === curriculoSelectedId);
            if (!disciplina) return undefined;
            const baseHours = disciplina.base_weekly_hours ?? null;
            const isOut = Boolean(baseHours && baseHours !== disciplina.carga_horaria_semanal);
            return { baseHours, isOutOfStandard: isOut };
          })()}
          onClose={() => setCurriculoModalOpen(false)}
          onSave={handleSaveCurriculoDisciplina}
          onQuickSave={handleQuickSaveCurriculoDisciplina}
        />
      )}
    </>
  );
}
