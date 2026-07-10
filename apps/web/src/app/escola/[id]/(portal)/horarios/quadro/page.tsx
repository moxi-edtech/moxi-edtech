"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { AlertCircle, Save, WifiOff, Printer, FileDown, Wand2 } from "lucide-react";
import { SchedulerBoard } from "@/components/escola/horarios/SchedulerBoard";
import { DisciplinaModal, type DisciplinaForm } from "@/components/escola/settings/_components/DisciplinaModal";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { useHorarioTurmaData } from "@/hooks/useHorarioData";
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <Spinner className="text-klasse-gold" size={24} />
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
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [clearingQuadro, setClearingQuadro] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictSlots, setConflictSlots] = useState<Record<string, boolean>>({});
  const [autoDraftDirty, setAutoDraftDirty] = useState(false);
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
    slots,
    slotLookup,
    salas,
    turmas,
    loading: baseLoading,
    error: baseError,
    setSalas,
    setTurmas,
    setRawSlots,
    refreshBaseData,
  } = useHorarioDataContext();

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

  // Mostrar wizard se não houver salas ou slots (e não estiver carregando)
  useEffect(() => {
    if (isMounted && !baseLoading && (salas.length === 0 || slots.length === 0)) {
      const skipKey = `horarios:wizard-skipped:${escolaId}`;
      const wasSkipped = typeof window !== "undefined" ? window.sessionStorage.getItem(skipKey) : null;
      if (!wasSkipped) {
        setShowWizard(true);
      }
    }
  }, [isMounted, baseLoading, salas.length, slots.length, escolaId]);

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
    const key = `horarios:versao:${escolaId}:${turmaId}`;
    const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
    if (stored) {
      setVersaoId(stored);
    }

    let active = true;
    fetch(`/api/secretaria/turmas/${turmaId}/horario/versao?escola_id=${encodeURIComponent(escolaId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const versaoPreferida = json?.versao_publicada_id || json?.versao_id;
        if (json?.ok && versaoPreferida) {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(key, versaoPreferida);
          }
          setVersaoId(versaoPreferida);
          return;
        }
        if (stored) {
          return;
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(key);
        }
        const next = crypto.randomUUID();
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, next);
        }
        setVersaoId(next);
      })
      .catch(() => {
        if (!active) return;
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(key);
        }
        const next = crypto.randomUUID();
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, next);
        }
        setVersaoId(next);
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
    setTurmaId((prev) => {
      if (prev && turmas.some((turma) => turma.id === prev)) return prev;
      if (turmaIdFromQuery && turmas.some((turma) => turma.id === turmaIdFromQuery)) return turmaIdFromQuery;
      return turmas[0]?.id ?? null;
    });
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

  const selectedTurma = useMemo(
    () => turmas.find((turma) => turma.id === turmaId) || null,
    [turmaId, turmas]
  );

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
  const canPublicar = true;
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
  const totalSlots = totalDias * temposAulaCount;
  const filledSlots = useMemo(
    () => Object.values(grid).filter((value) => Boolean(value)).length,
    [grid]
  );
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
    () => aulasWithAllocations.filter((aula) => !aula.missingLoad && aula.temposTotal > 0 && aula.temposAlocados >= aula.temposTotal).length,
    [aulasWithAllocations]
  );
  const disciplinasPendentes = useMemo(
    () =>
      aulasWithAllocations.filter(
        (aula) => aula.missingLoad || (aula.temposTotal > 0 && aula.temposAlocados < aula.temposTotal)
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

  const handleClearQuadro = async () => {
    if (!escolaId || !turmaId || !versaoId) return;
    const ok = await confirm({
      title: "Limpar quadro",
      message: "Deseja realmente apagar todos os horários desta turma? Esta acção é irreversível.",
      confirmLabel: "Limpar tudo",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setClearingQuadro(true);
      const res = await fetch(
        `/api/escolas/${escolaId}/horarios/quadro?versao_id=${versaoId}&turma_id=${turmaId}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao limpar o quadro.");
      }
      setGrid({});
      setAulas((prev) => prev.map((aula) => ({ ...aula, temposAlocados: 0 })));
      setAutoDraftDirty(false);
      refreshTurmaData();
      success("Quadro limpo com sucesso.");
    } catch (e: any) {
      error(e?.message || "Falha ao limpar o quadro.");
    } finally {
      setClearingQuadro(false);
    }
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
      await downloadHorarioTurmaPdf({ turma: { id: selectedTurma.id } });
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
    mode: "draft" | "publish",
    options?: { successTitle?: string; successMessage?: string }
  ): Promise<boolean> => {
    if (!escolaId || !turmaId || !versaoId) return false;

    if (mode === "draft") {
      setSaving(true);
    } else {
      setPublishing(true);
    }
    setSaveError(null);

    const items = Object.entries(nextGrid)
      .map(([slotKey, disciplinaId]) => ({ slotKey, disciplinaId }))
      .filter(({ slotKey, disciplinaId }) => disciplinaId && slotLookup[slotKey])
      .map(({ slotKey, disciplinaId }) => {
        const aula = aulasWithAllocations.find((item) => item.id === disciplinaId);
        const salaId = selectedTurma?.sala
          ? salas.find((sala) => sala.nome === selectedTurma.sala)?.id ?? null
          : null;
        return {
          slot_id: slotLookup[slotKey],
          disciplina_id: disciplinaId as string,
          professor_id: aula?.professorId ?? null,
          sala_id: salaId,
        };
      });

    const payload = {
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
      if (!online && mode === "publish") {
        error("Modo offline: conecte-se para publicar o quadro.");
        return false;
      }

      const res = await fetch(`/api/escolas/${escolaId}/horarios/quadro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setSaveError(json?.error || "Falha ao salvar quadro");
        if (json?.conflicts && Array.isArray(json.conflicts)) {
          const nextConflicts: Record<string, boolean> = {};
          for (const conflict of json.conflicts) {
            const slotKey = Object.entries(slotLookup).find(([, id]) => id === conflict.slot_id)?.[0];
            if (slotKey) nextConflicts[slotKey] = true;
          }
          setConflictSlots(nextConflicts);
          error(
            "Conflito de horário",
            `${json.conflicts.length} slot(s) têm professor ou sala já ocupados. Os horários em conflito foram destacados.`
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
      setAutoDraftDirty(false);
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
          "Quadro publicado com pendências",
          warningDetails || "Revise as cargas horárias quando terminar o primeiro ajuste."
        );
      }
      success(
        options?.successTitle ?? (mode === "publish" ? "Quadro publicado." : "Quadro salvo."),
        options?.successMessage
          ?? (mode === "publish"
            ? "Publicação concluída sem pendências."
            : "Você pode ajustar a distribuição a qualquer momento.")
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
  const handlePublicar = (nextGrid: Record<string, string | null>) => submitQuadro(nextGrid, "publish");

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
    if (!escolaId || !turmaId) return;
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
          overwrite_unlocked: true,
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

      const nextGrid: Record<string, string | null> = {};
      const countByDisc: Record<string, number> = {};
      for (const assignment of json.assignments || []) {
        const slotKey = reverseLookup[assignment.slot_id];
        if (!slotKey) continue;
        nextGrid[slotKey] = assignment.disciplina_id;
        countByDisc[assignment.disciplina_id] = (countByDisc[assignment.disciplina_id] || 0) + 1;
      }

      setGrid(() => nextGrid);
      setAulas((prev) =>
        prev.map((aula) => ({
          ...aula,
          temposAlocados: countByDisc[aula.id] ?? 0,
        }))
      );
      setAutoDraftDirty(true);
      setConflictSlots({});
      const saved = await submitQuadro(nextGrid, "draft", {
        successTitle: "Quadro auto-completado e salvo.",
        successMessage: `Preenchidos ${json?.stats?.filled ?? 0} de ${json?.stats?.total_slots ?? 0} slots.`,
      });
      if (!saved) {
        setAutoDraftDirty(true);
        warning("Auto-completar gerado mas não salvo", "Revise e clique em Salvar para persistir.");
      }
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
    if (!turmaId) return;
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
    if (!escolaId || !turmaId) return;
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <Spinner className="text-klasse-gold" size={24} />
        <span className="ml-3 text-sm">Carregando quadro...</span>
      </div>
    );
  }

  if (showWizard) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center">
        <div className="w-full max-w-6xl">
          <div className="mb-8 flex justify-between items-center">
            <Link href={dashboardHref} className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-all">
              ← Voltar ao Dashboard
            </Link>
            <Button variant="ghost" onClick={handleSkipWizard} className="text-slate-500 font-bold">
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
      <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <Link
                href={slotsHref}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Slots
              </Link>
              <Link
                href={quadroHref}
                className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Quadro
              </Link>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowWizard(true)} 
              className="rounded-full gap-2 text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 h-9"
            >
              <Wand2 className="w-3.5 h-3.5" /> Configurar base
            </Button>
            <Select
              value={turmaId ?? ""}
              options={turmaOptions}
              onChange={async (event) => {
                const nextTurmaId = event.target.value || null;
                if (nextTurmaId === turmaId) return;
                if (autoDraftDirty) {
                  const confirmed = await confirm({
                    title: "Alterações não salvas",
                    message: "Existem horários sugeridos que ainda não foram guardados. Se mudar de turma agora, estas sugestões serão perdidas. Deseja continuar?",
                    confirmLabel: "Continuar sem salvar",
                  });
                  if (!confirmed) return;
                }
                setTurmaId(nextTurmaId);
              }}
              className="max-w-xs rounded-xl border-slate-200 focus:border-klasse-gold focus:ring-klasse-gold text-slate-900"
            />            {selectedTurma?.sala ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Sala {selectedTurma.sala}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileDown className="h-3 w-3" />
              {downloadingPdf ? "Gerando PDF..." : "Baixar PDF"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3 w-3" />
              Imprimir
            </button>
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner size={14} className="text-klasse-gold" />
                Sincronizando dados...
              </div>
            ) : null}
            {showOfflineStatus ? (
              <div className="flex items-center gap-2 rounded-full bg-klasse-gold-100 px-3 py-1 text-xs font-semibold text-klasse-gold-800">
                <WifiOff className="h-3 w-3" />
                Modo offline
              </div>
            ) : null}
            {baseError ? <span className="text-xs text-rose-600">{baseError}</span> : null}
            {turmaError ? <span className="text-xs text-rose-600">{turmaError}</span> : null}
            {saveError ? <span className="text-xs text-rose-600">{saveError}</span> : null}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Save className={`h-4 w-4 ${saving ? "text-klasse-gold" : "text-slate-300"}`} />
              <span>
                {saving ? "Salvando..." : autoDraftDirty ? "Auto-completar não salvo" : "Alterações prontas"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {turmaId && excessoCarga > 0 && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Carga acima da capacidade do turno</p>
            <p className="text-xs text-rose-700 mt-1">
              A carga semanal do curso é {totalCarga} e o turno da {turnoLabel} suporta {totalSlots}.
            </p>
            {allCurriculoAtMed ? (
              <p className="text-xs text-rose-700 mt-1">
                O currículo já está no padrão MED. A próxima correção é comprimir o mesmo turno antes de qualquer outra saída.
              </p>
            ) : (
              <p className="text-xs text-rose-700 mt-1">
                Opção 1 (mais provável): reduzir a gordura do currículo para o padrão real do MED.
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
        {turmaId && (
          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Slots preenchidos</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {filledSlots}/{totalSlots || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalDias} dia(s) • {temposAulaCount} tempos/dia
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Disciplinas completas</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {disciplinasCompletas}/{aulas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Meta semanal por disciplina</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pendências de carga</p>
              <p className="text-2xl font-bold text-klasse-gold-600 mt-2">{missingLoadCount}</p>
              <p className="text-xs text-slate-500 mt-1">Sem carga definida</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Conflitos detectados</p>
              <p className="text-2xl font-bold text-rose-600 mt-2">{conflitosCount}</p>
              <p className="text-xs text-slate-500 mt-1">Professor/Sala</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sobrecarga</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overloadProfessores.length + overloadSalas.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Professores + salas</p>
            </div>
          </div>
        )}
        {turmaId && disciplinasPendentes.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Disciplinas pendentes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {disciplinasPendentes.slice(0, 6).map((disc) => (
                <span
                  key={disc.id}
                  className="rounded-full border border-klasse-gold-200 bg-klasse-gold-50 px-3 py-1 text-xs font-semibold text-klasse-gold-700"
                >
                  {disc.disciplina} {disc.temposAlocados}/{disc.temposTotal || "?"}
                </span>
              ))}
              {disciplinasPendentes.length > 6 && (
                <span className="text-xs text-slate-500">+{disciplinasPendentes.length - 6} mais</span>
              )}
            </div>
          </div>
        )}
        {turmaId && (overloadProfessores.length > 0 || overloadSalas.length > 0) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Alertas de sobrecarga</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overloadProfessores.map((prof) => (
                <span
                  key={`prof-${prof.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {prof.nome}: {prof.count} tempos
                </span>
              ))}
              {overloadSalas.map((sala) => (
                <span
                  key={`sala-${sala.id}`}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  {sala.nome}: {sala.count} tempos
                </span>
              ))}
            </div>
          </div>
        )}
        {missingLoadCount > 0 && (
          <div className="mb-4 rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 text-sm text-klasse-gold-800">
            <div className="font-semibold">{missingLoadCount} disciplina(s) sem carga horária.</div>
            <div className="mt-1">Pode publicar agora e ajustar as cargas depois em poucos cliques.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAutoConfigurar({ rerunAutoComplete: true })}
                disabled={autoConfiguring}
                className="rounded-lg bg-klasse-gold px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {autoConfiguring ? "Ajustando..." : "Preencher e redistribuir"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {missingLoadSuggestions.slice(0, 6).map((disc) => (
                <div
                  key={disc.id}
                  className="flex flex-col gap-2 rounded-xl border border-klasse-gold-200 bg-white/80 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{disc.disciplina}</div>
                    <div className="text-xs text-slate-600">
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
                        className="rounded-lg border border-klasse-gold-300 bg-klasse-gold-100 px-3 py-2 text-xs font-bold text-klasse-gold-900"
                      >
                        Usar MED {disc.suggestedHours}h e redistribuir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openCurriculoForDisciplina(disc.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
              {missingLoadSuggestions.length > 6 && (
                <div className="text-xs text-slate-600">
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
        {autoDraftDirty && turmaId && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">Distribuição gerada e ainda não salva.</div>
            <div className="mt-1">Salve agora para não perder o resultado do auto-completar.</div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => submitQuadro(grid, "draft")}
                disabled={saving || publishing}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar agora"}
              </button>
            </div>
          </div>
        )}
        {!turmaId ? (
          <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Selecione uma turma para montar o quadro.</p>
          </div>
        ) : (
          <SchedulerBoard
            diasSemana={DIAS_SEMANA}
            tempos={horariosDisponiveis}
            aulas={aulasWithAllocations}
            onSalvar={handleSalvar}
            grid={grid}
            onGridChange={(next) => setGrid(() => next)}
            slotLookup={slotLookup}
            existingAssignments={existingAssignments}
            conflictSlots={conflictSlots}
            salas={salas}
            professores={professores}
            onAssignProfessor={handleAssignProfessor}
            turmaSala={selectedTurma?.sala ?? null}
            onAssignTurmaSala={handleAssignTurmaSala}
            onAutoCompletar={handleAutoCompletar}
            autoCompleting={autoScheduling}
            onAutoConfigurarCargas={missingLoadCount > 0 ? handleAutoConfigurar : undefined}
            autoConfiguring={autoConfiguring}
            onPublicar={handlePublicar}
            canPublicar={canPublicar}
            publishDisabledReason={undefined}
            publishing={publishing}
          />
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
              className="h-10 w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold"
            />
            <button
              type="button"
              onClick={() => {
                if (!novaSala.trim()) return;
                handleAddSala(novaSala);
                setNovaSala("");
              }}
              className="h-10 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-slate-950 shadow-sm"
            >
              Adicionar sala
            </button>
            <button
              type="button"
              onClick={handleClearQuadro}
              disabled={clearingQuadro}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {clearingQuadro ? "Limpando..." : "Limpar quadro"}
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
