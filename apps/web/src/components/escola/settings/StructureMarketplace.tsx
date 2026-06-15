"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Trash2, Check, Settings, Plus, Info, Eraser, Users, X } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

import { CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/onboarding";
import { usePresetsCatalog, usePresetsMeta } from "@/hooks/usePresetSubjects";
import { createClient } from "@/lib/supabaseClient";
import { useEscolaId } from "@/hooks/useEscolaId";
import {
  PRESET_TO_TYPE,
  TYPE_COLORS,
  getTypeLabel,
  type CourseType,
} from "@/lib/courseTypes";

import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner as UISpinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

import ConfirmDialog from "./ConfirmDialog";
import CourseCreateModal from "./CourseCreateModal";
import CourseManager from "./CourseManager";
import { DisciplinaModal, type DisciplinaForm } from "./_components/DisciplinaModal";

/**
 * KLASSE UI rules applied:
 * - rounded-xl / rounded-full
 * - Dark UI: slate-950
 * - Gold for actions only (bg-klasse-gold)
 * - No teal palette
 * - Lucide icons only from allowed set (using subset)
 */

// ---------- Types ----------
// ... (rest of types)
export type ActiveCourse = {
  id: string;
  nome: string;
  codigo: string;
  total_classes: number;
  total_turmas: number;
  total_alunos: number;
  curriculum_key?: string | null;
};

export type CourseDetails = {
  id: string;
  disciplinas: {
    id: string;
    nome: string;
    codigo: string;
    carga_horaria_semanal: number;
    conta_para_media_med?: boolean | null;
    is_core: boolean;
    participa_horario: boolean;
    is_avaliavel: boolean;
    avaliacao_mode: "herdar_escola" | "personalizada";
    area?: string | null;
    classificacao?: "core" | "complementar" | "optativa" | null;
    periodos_ativos?: number[] | null;
    entra_no_horario?: boolean | null;
    avaliacao_mode_key?: "inherit_school" | "custom" | "inherit_disciplina" | null;
    avaliacao_disciplina_id?: string | null;
    modelo_excecao_id?: string | null;
    status_completude?: string | null;
    curriculo_status?: string | null;
    matrix_ids: string[];
    class_ids: string[];
    matrix_by_class: Record<string, string[]>;
  }[];
  turmas: {
    id: string;
    nome: string;
    classe: string;
    turno: string;
    total_alunos: number;
  }[];
  classes: { id: string; nome: string }[];
};

export type DraftDisciplina = {
  nome: string;
  carga_horaria: number;
  is_core: boolean;
  is_avaliavel: boolean;
  area: string;
  modelo_avaliacao_id: string;
};

export type CourseDraft = {
  label: string;
  classes: string[];
  subjects: DraftDisciplina[];
  isCustom: boolean;
  baseKey: string;
};

type ModeloAvaliacao = {
  id: string;
  nome: string;
  curso_id?: string | null;
  is_default?: boolean | null;
};

type CourseAvaliacao = {
  global_default: ModeloAvaliacao | null;
  course_default: ModeloAvaliacao | null;
  modelos: ModeloAvaliacao[];
};

type ActiveTab = "my_courses" | "catalog";
type ManagerTab = "turmas" | "disciplinas" | "avaliacao";

type TurmaCleanupItem = {
  id: string;
  nome: string;
  classe: string;
  turno: string;
  total_alunos: number;
};

export type CurriculoStatus = {
  curso_id: string;
  classe_id?: string | null;
  status: "draft" | "published" | "archived" | "none";
  version: number;
  ano_letivo_id: string;
};

const ALL_CLASSES = ["7ª", "8ª", "9ª", "10ª", "11ª", "12ª", "13ª"];

// ---------- Small UI helpers ----------
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SpinnerLabel({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

// ---------- API layer (thin wrapper) ----------
async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    const msg = json?.error || "Falha na requisição.";
    throw new Error(msg);
  }
  return json.data as T;
}

// ---------- Component ----------
export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const apiEscolaId = escolaParam;
  const supabase = useMemo(() => createClient(), []);
  const { success, error, warning } = useToast();
  const searchParams = useSearchParams();
  const resolvePendenciasRequested = searchParams?.get("resolvePendencias") === "1";
  const courseIdFromQuery = searchParams?.get("cursoId") || searchParams?.get("curso_id");
  const focusDisciplinaRequested = searchParams?.get("focusDisciplina") === "1";
  const focusDisciplinaId = searchParams?.get("disciplinaId") || searchParams?.get("disciplina_id");
  const [activeTab, setActiveTab] = useState<ActiveTab>("my_courses");
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Manager
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [managerTab, setManagerTab] = useState<ManagerTab>("turmas");
  const [details, setDetails] = useState<CourseDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingAvaliacao, setLoadingAvaliacao] = useState(false);
  const [courseAvaliacao, setCourseAvaliacao] = useState<CourseAvaliacao | null>(null);
  const [curriculoStatusByCurso, setCurriculoStatusByCurso] = useState<Record<string, CurriculoStatus[]>>({});
  const [curriculoAnoLetivo, setCurriculoAnoLetivo] = useState<{ id: string; ano: number } | null>(null);

  // Modal create
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [installing, setInstalling] = useState(false);
  const [quickInstallingKey, setQuickInstallingKey] = useState<string | null>(null);
  const [preparingCourseId, setPreparingCourseId] = useState<string | null>(null);

  const [disciplinaModalOpen, setDisciplinaModalOpen] = useState(false);
  const [disciplinaModalMode, setDisciplinaModalMode] = useState<"create" | "edit">("create");
  const [disciplinaEditing, setDisciplinaEditing] = useState<DisciplinaForm | null>(null);
  const [disciplinaEditingMatrixIds, setDisciplinaEditingMatrixIds] = useState<string[]>([]);
  const [disciplinaEditingMatrixByClass, setDisciplinaEditingMatrixByClass] = useState<Record<string, string[]>>({});
  const [resolvePendencias, setResolvePendencias] = useState(false);
  const [autoResolveTriggered, setAutoResolveTriggered] = useState(false);
  const [autoFocusTriggered, setAutoFocusTriggered] = useState(false);
  const [turmaCleanupOpen, setTurmaCleanupOpen] = useState(false);
  const [turmaCleanupLoading, setTurmaCleanupLoading] = useState(false);
  const [turmaCleanupRunning, setTurmaCleanupRunning] = useState(false);
  const [turmaCleanupCourse, setTurmaCleanupCourse] = useState<ActiveCourse | null>(null);
  const [turmaCleanupItems, setTurmaCleanupItems] = useState<TurmaCleanupItem[]>([]);
  const [turmaCleanupSelectedIds, setTurmaCleanupSelectedIds] = useState<string[]>([]);

  const openCreateDisciplina = useCallback(() => {
    setDisciplinaModalMode("create");
    setDisciplinaEditing(null);
    setResolvePendencias(false);
    setDisciplinaModalOpen(true);
  }, []);

  const openEditDisciplina = useCallback((disciplina: CourseDetails["disciplinas"][number], resolveMode = false) => {
    setDisciplinaModalMode("edit");
    setResolvePendencias(resolveMode);
    setDisciplinaEditing({
      id: disciplina.id,
      nome: disciplina.nome,
      codigo: disciplina.codigo,
      periodos_ativos: disciplina.periodos_ativos?.length ? disciplina.periodos_ativos : [1, 2, 3],
      periodo_mode: disciplina.periodos_ativos?.length ? "custom" : "ano",
      carga_horaria_semanal: disciplina.carga_horaria_semanal,
      classificacao: disciplina.classificacao ?? (disciplina.is_core ? "core" : "complementar"),
      entra_no_horario: disciplina.entra_no_horario ?? disciplina.participa_horario,
      is_avaliavel: disciplina.is_avaliavel ?? true,
      conta_para_media_med: disciplina.conta_para_media_med ?? true,
      avaliacao: {
        mode: disciplina.avaliacao_mode_key ?? (disciplina.avaliacao_mode === "personalizada" ? "custom" : "inherit_school"),
        base_id: disciplina.avaliacao_disciplina_id ?? null,
      },
      modelo_excecao_id: disciplina.modelo_excecao_id ?? null,
      area: disciplina.area ?? null,
      programa_texto: null,
      class_ids: disciplina.class_ids ?? [],
    } as DisciplinaForm);
    setDisciplinaEditingMatrixIds(disciplina.matrix_ids ?? []);
    setDisciplinaEditingMatrixByClass(disciplina.matrix_by_class ?? {});
    setDisciplinaModalOpen(true);
  }, []);

  // Confirm dialogs (replace confirm/prompt)
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    desc?: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm?: () => void;
  }>({ open: false, title: "" });

  const closeConfirm = () =>
    setConfirmState({ open: false, title: "" });

  const buildDraftDisciplina = useCallback((nome: string): DraftDisciplina => {
    return {
      nome,
      carga_horaria: 0,
      is_core: true,
      is_avaliavel: true,
      area: "",
      modelo_avaliacao_id: "",
    };
  }, []);

  // -------- Fetch courses --------
  const fetchCourses = useCallback(async () => {
    if (!apiEscolaId) {
      setLoadingCourses(false);
      return;
    }
    setLoadingCourses(true);
    const ac = new AbortController();
    try {
      const data = await apiGet<ActiveCourse[]>(
        `/api/escolas/${apiEscolaId}/cursos/stats`,
        ac.signal
      );
      setCourses(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingCourses(false);
    }
    return () => ac.abort();
  }, [apiEscolaId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const loadCurriculoStatus = useCallback(async () => {
    const res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/status`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "Falha ao carregar status do currículo.");
    }
    const map: Record<string, CurriculoStatus[]> = {};
    (json.curriculos ?? []).forEach((row: CurriculoStatus) => {
      const bucket = map[row.curso_id] ?? [];
      bucket.push(row);
      map[row.curso_id] = bucket;
    });
    setCurriculoStatusByCurso(map);
    setCurriculoAnoLetivo(json.ano_letivo ?? null);
  }, [escolaParam]);

  useEffect(() => {
    loadCurriculoStatus().catch((e: any) => console.warn(e));
  }, [loadCurriculoStatus]);

  // -------- Details --------
  const fetchCourseDetails = useCallback(
    async (courseId: string): Promise<CourseDetails> => {
      if (!apiEscolaId) throw new Error("Escola não identificada.");
      const [classesRes, disciplinasRes, turmasRes] = await Promise.all([
        fetch(`/api/escolas/${apiEscolaId}/classes?curso_id=${courseId}&limit=50`, {
          cache: "no-store",
        }),
        fetch(`/api/escolas/${apiEscolaId}/disciplinas?curso_id=${courseId}&limit=200`, {
          cache: "no-store",
        }),
        fetch(`/api/escolas/${apiEscolaId}/turmas?curso_id=${courseId}&limit=50`, {
          cache: "no-store",
        }),
      ]);

      const [classesJson, disciplinasJson, turmasJson] = await Promise.all([
        classesRes.json().catch(() => null),
        disciplinasRes.json().catch(() => null),
        turmasRes.json().catch(() => null),
      ]);

      if (!classesRes.ok || classesJson?.ok === false) {
        throw new Error(classesJson?.error || "Falha ao carregar classes.");
      }
      if (!disciplinasRes.ok || disciplinasJson?.ok === false) {
        throw new Error(disciplinasJson?.error || "Falha ao carregar disciplinas.");
      }
      if (!turmasRes.ok || turmasJson?.ok === false) {
        throw new Error(turmasJson?.error || "Falha ao carregar turmas.");
      }

      const classes = (classesJson?.data ?? []).map((item: any) => ({
        id: item.id,
        nome: item.nome,
      }));
      const classesById = new Map<string, string>(
        classes.map((item: { id: string; nome: string }) => [item.id, item.nome])
      );

      const rawDisciplinas = disciplinasJson?.data ?? [];
      const filteredDisciplinas = curriculoAnoLetivo?.id
        ? rawDisciplinas.filter(
            (item: any) =>
              !item.classe_ano_letivo_id || item.classe_ano_letivo_id === curriculoAnoLetivo.id
          )
        : rawDisciplinas;
      const disciplinaRows = filteredDisciplinas.length > 0 ? filteredDisciplinas : rawDisciplinas;

      const disciplinaGroups = new Map<string, any[]>();
      disciplinaRows.forEach((item: any) => {
        const key = item.disciplina_id ?? item.nome ?? item.id;
        const bucket = disciplinaGroups.get(key);
        if (bucket) bucket.push(item);
        else disciplinaGroups.set(key, [item]);
      });

      const disciplinaMap = new Map<string, CourseDetails["disciplinas"][number]>();
      disciplinaGroups.forEach((items, key) => {
        const draftItems = items.filter((item) => item.curriculo_status === "draft");
        const sourceItems = draftItems.length > 0 ? draftItems : items;

        const primary = sourceItems[0];
        const base: CourseDetails["disciplinas"][number] = {
          id: key,
          nome: primary.nome,
          codigo: primary.sigla ?? primary.codigo ?? primary.nome?.slice(0, 6)?.toUpperCase() ?? "",
          carga_horaria_semanal: Number(primary.carga_horaria_semanal ?? primary.carga_horaria ?? 0),
          conta_para_media_med: primary.conta_para_media_med ?? null,
          is_core: Boolean(primary.is_core ?? (primary.classificacao === "core" || primary.tipo === "core")),
          participa_horario: primary.entra_no_horario ?? true,
          is_avaliavel: primary.is_avaliavel ?? true,
          avaliacao_mode: primary.avaliacao_mode === "custom" ? "personalizada" : "herdar_escola",
          area: primary.area ?? null,
          classificacao: primary.classificacao ?? null,
          periodos_ativos: primary.periodos_ativos ?? null,
          entra_no_horario: primary.entra_no_horario ?? null,
          avaliacao_mode_key: primary.avaliacao_mode ?? null,
          avaliacao_disciplina_id: primary.avaliacao_disciplina_id ?? null,
          modelo_excecao_id: primary.modelo_excecao_id ?? null,
          status_completude: primary.status_completude ?? null,
          curriculo_status: primary.curriculo_status ?? null,
          matrix_ids: [],
          class_ids: [],
          matrix_by_class: {},
        };

        sourceItems.forEach((item) => {
          if (item.id && !base.matrix_ids.includes(item.id as string)) {
            base.matrix_ids.push(item.id as string);
          }
          const classId = item.classe_id as string | undefined;
          if (classId) {
            if (!base.class_ids.includes(classId)) base.class_ids.push(classId);
            const classMatrixIds = base.matrix_by_class[classId] ?? [];
            if (item.id && !classMatrixIds.includes(item.id as string)) {
              classMatrixIds.push(item.id as string);
            }
            base.matrix_by_class[classId] = classMatrixIds;
          }
        });

        disciplinaMap.set(key, base);
      });

      const disciplinas = Array.from(disciplinaMap.values());

      const turmas = (turmasJson?.items ?? turmasJson?.data ?? []).map((item: any) => ({
        id: item.id,
        nome: item.nome,
        classe:
          item.classe_nome ||
          classesById.get(item.classe_id) ||
          item.classe ||
          "Sem classe",
        turno: item.turno ?? "-",
        total_alunos: Number(item.ocupacao_atual ?? 0),
      }));

      return {
        id: courseId,
        classes,
        disciplinas,
        turmas,
      };
    },
    [apiEscolaId, curriculoAnoLetivo?.id]
  );

  const handleOpenManager = useCallback(
    async (courseId: string, tab: ManagerTab = "turmas") => {
      if (!apiEscolaId) {
        error("Escola não identificada.");
        return;
      }
      setSelectedCourseId(courseId);
      setManagerTab(tab);
      setLoadingDetails(true);
      setLoadingAvaliacao(true);
      setDetails(null);
      setCourseAvaliacao(null);

      try {
        const [nextDetails, avaliacaoRes] = await Promise.all([
          fetchCourseDetails(courseId),
          fetch(`/api/escolas/${apiEscolaId}/cursos/${courseId}/avaliacao`, { cache: "no-store" })
            .then(async (res) => {
              const json = await res.json().catch(() => null);
              if (!res.ok || json?.ok === false) {
                throw new Error(json?.error || "Falha ao carregar avaliação do curso.");
              }
              return json.data as CourseAvaliacao;
            }),
        ]);
        setDetails(nextDetails);
        setCourseAvaliacao(avaliacaoRes);
      } catch (e: any) {
        console.error(e);
        error(e?.message || "Erro ao carregar detalhes do curso.");
        setSelectedCourseId(null);
      } finally {
        setLoadingDetails(false);
        setLoadingAvaliacao(false);
      }
    },
    [apiEscolaId, error, fetchCourseDetails]
  );

  useEffect(() => {
    if (autoResolveTriggered) return;
    if (searchParams?.get("resolvePendencias") !== "1") return;
    if (loadingCourses) return;

    const run = async () => {
      try {
        const targetCourseId = courseIdFromQuery || courses[0]?.id;
        if (!targetCourseId) return;
        if (!courseIdFromQuery) {
          const res = await fetch(`/api/escolas/${apiEscolaId}/disciplinas?status_completude=incompleto&limit=1`, {
            cache: "no-store",
          });
          const json = await res.json().catch(() => null);
          const first = json?.data?.[0];
          if (first?.curso_id) {
            await handleOpenManager(first.curso_id, "disciplinas");
            setActiveTab("my_courses");
            return;
          }
        }
        if (targetCourseId) {
          await handleOpenManager(targetCourseId, "disciplinas");
          setActiveTab("my_courses");
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAutoResolveTriggered(true);
      }
    };

    run();
  }, [apiEscolaId, autoResolveTriggered, courseIdFromQuery, courses, handleOpenManager, loadingCourses, searchParams]);

  useEffect(() => {
    if (autoFocusTriggered) return;
    if (!focusDisciplinaRequested && !focusDisciplinaId) return;
    if (!selectedCourseId || loadingDetails || !details) return;

    const resolved = focusDisciplinaId
      ? details.disciplinas.find((disc) =>
          disc.id === focusDisciplinaId || (disc.matrix_ids ?? []).includes(focusDisciplinaId)
        )
      : null;
    const target = resolved ?? details.disciplinas[0];
    if (!target) {
      setAutoFocusTriggered(true);
      return;
    }

    setManagerTab("disciplinas");
    setActiveTab("my_courses");
    openEditDisciplina(target, false);
    setAutoFocusTriggered(true);
  }, [
    autoFocusTriggered,
    details,
    focusDisciplinaId,
    focusDisciplinaRequested,
    loadingDetails,
    openEditDisciplina,
    selectedCourseId,
  ]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const getCourseCurriculoStatus = useCallback(
    (courseId: string): CurriculoStatus["status"] | "none" => {
      const curriculos = curriculoStatusByCurso[courseId] ?? [];
      if (curriculos.length === 0) return "none";
      if (curriculos.every((row) => row.status === "published")) return "published";
      if (curriculos.some((row) => row.status === "draft")) return "draft";
      return curriculos[0]?.status ?? "none";
    },
    [curriculoStatusByCurso]
  );

  // -------- CRUD (UI-safe stubs, sem prompt/confirm) --------
  const generateTurmasForCourse = useCallback(
    async (cursoId: string) => {
      const curriculos = curriculoStatusByCurso[cursoId] ?? [];
      const hasPublished = curriculos.length > 0 && curriculos.every((c) => c.status === "published");
      if (!hasPublished) {
        error("Publique o currículo antes de gerar turmas.");
        return false;
      }
      if (!curriculoAnoLetivo?.ano) {
        error("Ano letivo ativo não encontrado.");
        return false;
      }

      setPreparingCourseId(cursoId);
      try {
        const res = await fetch(`/api/escola/${escolaParam}/admin/turmas/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            cursoId,
            anoLetivo: curriculoAnoLetivo.ano,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao gerar turmas.");
        }
        const nextDetails = await fetchCourseDetails(cursoId);
        if (selectedCourseId === cursoId) {
          setDetails(nextDetails);
        }
        await fetchCourses();
        await loadCurriculoStatus();
        success("Turmas preparadas.");
        return true;
      } catch (e: any) {
        error(e?.message || "Falha ao gerar turmas.");
        return false;
      } finally {
        setPreparingCourseId(null);
      }
    },
    [
      curriculoAnoLetivo,
      curriculoStatusByCurso,
      escolaParam,
      error,
      fetchCourseDetails,
      fetchCourses,
      loadCurriculoStatus,
      selectedCourseId,
      success,
    ]
  );

  const handleAddTurma = useCallback(
    async (cursoId: string) => {
      setConfirmState({
        open: true,
        title: "Preparar turmas",
        desc: "Será criada a primeira turma de cada classe e as disciplinas serão vinculadas automaticamente.",
        confirmLabel: "Preparar",
        onConfirm: async () => {
          closeConfirm();
          await generateTurmasForCourse(cursoId);
        },
      });
    },
    [generateTurmasForCourse]
  );

  // -------- Presets helpers --------
  const extractSubjectsFromPreset = useCallback(
    async (key: CurriculumKey): Promise<DraftDisciplina[]> => {
      const { data: presetRows, error: presetErr } = await supabase
        .from("curriculum_preset_subjects")
        .select("id, name")
        .eq("preset_id", key);

      if (presetErr) throw presetErr;

      const presetIds = (presetRows || []).map((row: any) => row.id).filter(Boolean);
      let schoolMap = new Map<string, any>();
      if (presetIds.length > 0) {
        const { data: schoolRows, error: schoolErr } = await supabase
          .from("school_subjects")
          .select("preset_subject_id, custom_name, is_active")
          .eq("escola_id", escolaId)
          .in("preset_subject_id", presetIds);
        if (schoolErr) throw schoolErr;
        schoolMap = new Map((schoolRows || []).map((row: any) => [row.preset_subject_id, row]));
      }

      const subjects = (presetRows || [])
        .map((row: any) => {
          const override = schoolMap.get(row.id);
          if (override?.is_active === false) return null;
          return String(override?.custom_name ?? row.name ?? "").trim();
        })
        .filter(Boolean) as string[];

      return Array.from(new Set(subjects)).map((nome) => buildDraftDisciplina(nome));
    },
    [buildDraftDisciplina, escolaId, supabase]
  );

  const presetKeys = useMemo(
    () => Object.keys(CURRICULUM_PRESETS_META) as CurriculumKey[],
    []
  );
  const { metaMap: presetMetaMap } = usePresetsMeta(presetKeys);
  const { catalogMap: presetCatalogMap } = usePresetsCatalog(presetKeys);

  const presetsList = useMemo(() => {
    return Object.entries(CURRICULUM_PRESETS_META).map(([k, m]) => {
      const { key: _omit, ...rest } = m as any;
      const catalog = presetCatalogMap[k];
      return {
        key: k as CurriculumKey,
        ...rest,
        label: catalog?.name ?? rest.label,
        description: catalog?.description ?? rest.description,
      };
    });
  }, [presetCatalogMap]);

  const openPresetConfig = useCallback(
    async (presetKey: string) => {
      const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
      const presetMeta = presetMetaMap[presetKey];
      const catalog = presetCatalogMap[presetKey];
      const subjects = await extractSubjectsFromPreset(presetKey as CurriculumKey);
      const classes = presetMeta?.classes?.length ? [...presetMeta.classes] : [];

      setDraft({
        label: catalog?.name ?? (meta?.label || "Novo Curso"),
        classes,
        subjects,
        isCustom: false,
        baseKey: presetKey,
      });
      setShowModal(true);
    },
    [extractSubjectsFromPreset, presetMetaMap, presetCatalogMap]
  );

  const openCustomConfig = useCallback(() => {
    setDraft({
      label: "",
      classes: ["10ª Classe"],
      subjects: [buildDraftDisciplina("Língua Portuguesa")],
      isCustom: true,
      baseKey: "custom_builder",
    });
    setShowModal(true);
  }, [buildDraftDisciplina]);

  const toggleClass = useCallback((clsRaw: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const cls = clsRaw.includes("Classe") ? clsRaw : `${clsRaw} Classe`;
      const has = prev.classes.includes(cls);
      const next = has ? prev.classes.filter((c) => c !== cls) : [...prev.classes, cls];
      const sorted = next.sort((a, b) => parseInt(a) - parseInt(b));
      return { ...prev, classes: sorted };
    });
  }, []);

  const handleAddDisciplina = useCallback((disciplina: DraftDisciplina) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.subjects.some((s) => s.nome === disciplina.nome)) {
        error("Já existe.");
        return prev;
      }
      return { ...prev, subjects: [...prev.subjects, disciplina] };
    });
  }, [error]);

  const handleRemoveDisciplina = useCallback((name: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, subjects: prev.subjects.filter((s) => s.nome !== name) };
    });
  }, []);

  const handleQuickInstall = useCallback(
    async (presetKey: CurriculumKey) => {
      setQuickInstallingKey(presetKey);
      try {
        const res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/install-preset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey,
            options: { autoPublish: true, generateTurmas: true },
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao instalar preset.");
        }
        if (json?.applied?.skipped) {
          warning(
            "Preset não aplicado",
            json?.applied?.message || "Já existe currículo publicado para este curso/ano letivo."
          );
        } else {
          success("Curso instalado e turmas preparadas.");
        }
        await fetchCourses();
        await loadCurriculoStatus();
        setActiveTab("my_courses");
      } catch (e: any) {
        error(e?.message || "Falha ao instalar preset.");
      } finally {
        setQuickInstallingKey(null);
      }
    },
    [error, escolaParam, fetchCourses, loadCurriculoStatus, success, warning]
  );

  const handleSave = useCallback(async () => {
    if (!apiEscolaId) {
      error("Escola não identificada.");
      return;
    }
    if (!draft) return;

    if (!draft.label.trim()) {
      error("Nome do curso é obrigatório.");
      return;
    }
    if (draft.classes.length === 0) {
      error("Selecione ao menos 1 classe.");
      return;
    }
    if (draft.subjects.length === 0) {
      error("Adicione ao menos 1 disciplina.");
      return;
    }

    setInstalling(true);
    try {
      let presetSkipped = false;
      if (!draft.isCustom && draft.baseKey in CURRICULUM_PRESETS_META) {
        const subjects = draft.subjects.map((s) => s.nome);
        const turnos = { manha: true, tarde: false, noite: false };
        const matrix: Record<string, boolean> = {};
        for (const subject of subjects) {
          for (const cls of draft.classes) {
            matrix[`${subject}::${cls}::M`] = true;
          }
        }

        const res = await fetch(`/api/escola/${escolaParam}/admin/curriculo/install-preset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey: draft.baseKey,
            customData: {
              label: draft.label,
              associatedPreset: draft.baseKey,
              classes: draft.classes,
              subjects,
            },
            advancedConfig: {
              classes: draft.classes,
              subjects,
              matrix,
              turnos,
            },
            options: { autoPublish: false, generateTurmas: false },
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao aplicar preset.");
        }
        if (json?.applied?.skipped) {
          presetSkipped = true;
          warning(
            "Preset não aplicado",
            json?.applied?.message || "Já existe currículo publicado para este curso/ano letivo."
          );
        }
      } else {
        const createRes = await fetch(`/api/escolas/${apiEscolaId}/cursos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: draft.label,
          }),
        });
        const createJson = await createRes.json().catch(() => null);
        if (!createRes.ok || createJson?.ok === false) {
          throw new Error(createJson?.error || "Falha ao criar curso.");
        }

        const cursoId = createJson?.data?.id as string | undefined;
        if (!cursoId) {
          throw new Error("Curso não identificado.");
        }

        const createdClasses: Array<{ id: string; nome: string }> = [];
        for (const cls of draft.classes) {
          const classRes = await fetch(`/api/escolas/${apiEscolaId}/classes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: cls, curso_id: cursoId }),
          });
          const classJson = await classRes.json().catch(() => null);
          if (!classRes.ok || classJson?.ok === false) {
            throw new Error(classJson?.error || "Falha ao criar classe.");
          }
          if (classJson?.data?.id) {
            createdClasses.push({ id: classJson.data.id, nome: cls });
          }
        }

        for (const cls of createdClasses) {
          for (const disciplina of draft.subjects) {
            const discRes = await fetch(`/api/escolas/${apiEscolaId}/disciplinas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: disciplina.nome,
                curso_id: cursoId,
                classe_id: cls.id,
                carga_horaria: disciplina.carga_horaria,
                carga_horaria_semanal: disciplina.carga_horaria,
                classificacao: disciplina.is_core ? "core" : "complementar",
                is_avaliavel: disciplina.is_avaliavel,
                area: disciplina.area || null,
                periodos_ativos: [1, 2, 3],
                entra_no_horario: true,
                avaliacao_mode: "inherit_school",
                avaliacao_modelo_id: null,
                avaliacao_disciplina_id: null,
                create_local_disciplina: true,
              }),
            });
            const discJson = await discRes.json().catch(() => null);
            if (!discRes.ok || discJson?.ok === false) {
              throw new Error(discJson?.error || "Falha ao criar disciplina.");
            }
          }
        }
      }

      if (!presetSkipped) {
        success("Curso criado com sucesso.");
      }
      setShowModal(false);
      setDraft(null);
      fetchCourses();
      setActiveTab("my_courses");
    } catch (e: any) {
      error(e?.message || "Erro ao criar curso.");
    } finally {
      setInstalling(false);
    }
  }, [apiEscolaId, draft, error, escolaParam, fetchCourses, success, warning]);

  const handleRemoveCourse = useCallback((id: string, totalAlunos: number) => {
    if (!apiEscolaId) {
      error("Escola não identificada.");
      return;
    }
    if (totalAlunos > 0) {
      error("Curso tem alunos vinculados.");
      return;
    }

    setConfirmState({
      open: true,
      title: "Remover curso",
      desc: "Essa ação é destrutiva. (No contrato: curso ativo deveria ir para 'inativo' e manter histórico.)",
      confirmLabel: "Remover",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/escolas/${apiEscolaId}/cursos/${id}`, {
            method: "DELETE",
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Erro ao remover curso.");
          }
          success("Curso removido.");
          fetchCourses();
        } catch (e: any) {
          error(e?.message || "Erro ao remover curso.");
        }
      },
    });
  }, [apiEscolaId, error, fetchCourses, success]);

  const handleSaveDisciplina = useCallback(
    async (payload: DisciplinaForm) => {
      if (!apiEscolaId) {
        error("Escola não identificada.");
        return;
      }
      if (!details || !selectedCourseId) return;
      try {
        if (disciplinaModalMode === "create") {
          if (details.classes.length === 0) {
            error("Cadastre classes antes de adicionar disciplinas.");
            return;
          }

          const targetClassIds = payload.class_ids?.length
            ? payload.class_ids
            : details.classes.map((classe) => classe.id);
          const targetClasses = details.classes.filter((classe) => targetClassIds.includes(classe.id));
          if (targetClasses.length === 0) {
            error("Selecione ao menos uma classe.");
            return;
          }

          await Promise.all(
            targetClasses.map(async (classe) => {
              const res = await fetch(`/api/escolas/${apiEscolaId}/disciplinas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nome: payload.nome,
                  curso_id: selectedCourseId,
                  classe_id: classe.id,
                  sigla: payload.codigo,
                  carga_horaria_semanal: payload.carga_horaria_semanal,
                  carga_horaria: payload.carga_horaria_semanal,
                  classificacao: payload.classificacao,
                  is_avaliavel: payload.is_avaliavel ?? true,
                  conta_para_media_med: payload.conta_para_media_med ?? true,
                  area: payload.area ?? null,
                  periodos_ativos: payload.periodos_ativos,
                  entra_no_horario: payload.entra_no_horario,
                  avaliacao_mode: payload.avaliacao.mode,
                  avaliacao_modelo_id:
                    payload.avaliacao.mode === "custom"
                      ? payload.modelo_excecao_id ?? null
                      : null,
                  avaliacao_disciplina_id:
                    payload.avaliacao.mode === "inherit_disciplina"
                      ? payload.avaliacao.base_id ?? null
                      : null,
                  modelo_excecao_id:
                    payload.avaliacao.mode === "custom"
                      ? payload.modelo_excecao_id ?? null
                      : null,
                  create_local_disciplina: true,
                }),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok || json?.ok === false) {
                throw new Error(json?.error || "Falha ao criar disciplina.");
              }
            })
          );

          success("Disciplina criada.");
          const nextDetails = await fetchCourseDetails(selectedCourseId);
          setDetails(nextDetails);
          return;
        }

        if (!payload.id || disciplinaEditingMatrixIds.length === 0) return;
        let matrixIds = disciplinaEditingMatrixIds;
        if (payload.apply_scope === "selected" && payload.class_ids?.length) {
          matrixIds = payload.class_ids.flatMap(
            (classId) => disciplinaEditingMatrixByClass[classId] ?? []
          );
        }

        if (matrixIds.length === 0) {
          error("Nenhuma classe selecionada para aplicar alterações.");
          return;
        }

        await Promise.all(
          matrixIds.map(async (matrixId) => {
            const res = await fetch(`/api/escolas/${apiEscolaId}/disciplinas/${matrixId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: payload.nome,
                sigla: payload.codigo,
                carga_horaria_semanal: payload.carga_horaria_semanal,
                carga_horaria: payload.carga_horaria_semanal,
                classificacao: payload.classificacao,
                is_avaliavel: payload.is_avaliavel ?? true,
                conta_para_media_med: payload.conta_para_media_med ?? true,
                area: payload.area ?? null,
                periodos_ativos: payload.periodos_ativos,
                entra_no_horario: payload.entra_no_horario,
                avaliacao_mode: payload.avaliacao.mode,
                avaliacao_modelo_id:
                  payload.avaliacao.mode === "custom"
                    ? payload.modelo_excecao_id ?? null
                    : null,
                avaliacao_disciplina_id:
                  payload.avaliacao.mode === "inherit_disciplina"
                    ? payload.avaliacao.base_id ?? null
                    : null,
                modelo_excecao_id:
                  payload.avaliacao.mode === "custom"
                    ? payload.modelo_excecao_id ?? null
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
        const nextDetails = await fetchCourseDetails(selectedCourseId);
        setDetails(nextDetails);
      } catch (e: any) {
        error(e?.message || "Falha ao salvar disciplina.");
      }
    },
    [
      details,
      disciplinaEditingMatrixByClass,
      disciplinaEditingMatrixIds,
      disciplinaModalMode,
      error,
      apiEscolaId,
      fetchCourseDetails,
      selectedCourseId,
      success,
    ]
  );

  const pendingDisciplines = useMemo(
    () => (details?.disciplinas ?? []).filter((disc) => disc.status_completude !== "completo"),
    [details]
  );

  const handleResolvePendencias = useCallback(() => {
    if (pendingDisciplines.length === 0) return;
    openEditDisciplina(pendingDisciplines[0], true);
  }, [openEditDisciplina, pendingDisciplines]);

  const handleUpdateAvaliacao = useCallback(
    async (payload: { override: boolean; modeloId?: string | null }) => {
      if (!apiEscolaId) {
        error("Escola não identificada.");
        return;
      }
      if (!selectedCourseId) return;
      try {
        const res = await fetch(`/api/escolas/${apiEscolaId}/cursos/${selectedCourseId}/avaliacao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: payload.override, modelo_id: payload.modeloId ?? null }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao atualizar avaliação do curso.");
        }
        const refreshed = await fetch(`/api/escolas/${apiEscolaId}/cursos/${selectedCourseId}/avaliacao`, {
          cache: "no-store",
        }).then(async (resp) => {
          const data = await resp.json().catch(() => null);
          if (!resp.ok || data?.ok === false) {
            throw new Error(data?.error || "Falha ao recarregar avaliação do curso.");
          }
          return data.data as CourseAvaliacao;
        });
        setCourseAvaliacao(refreshed);
        success("Regra de avaliação atualizada.");
      } catch (e: any) {
        error(e?.message || "Erro ao salvar regra do curso.");
      }
    },
    [apiEscolaId, error, selectedCourseId, success]
  );

  useEffect(() => {
    if (searchParams?.get("resolvePendencias") !== "1") return;
    if (!selectedCourseId || loadingDetails) return;
    if (!resolvePendencias && pendingDisciplines.length > 0) {
      handleResolvePendencias();
    }
  }, [handleResolvePendencias, loadingDetails, pendingDisciplines.length, resolvePendencias, searchParams, selectedCourseId]);

  const handleDeleteDisciplina = useCallback(
    async (id: string) => {
      if (!apiEscolaId) {
        error("Escola não identificada.");
        return;
      }
      if (!details || !selectedCourseId) return;
      const disciplina = details.disciplinas.find((d) => d.id === id);
      const matrixIds = disciplina?.matrix_ids ?? [];
      if (matrixIds.length === 0) return;
      try {
        await Promise.all(
          matrixIds.map(async (matrixId) => {
            const res = await fetch(`/api/escolas/${apiEscolaId}/disciplinas/${matrixId}`, {
              method: "DELETE",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
              throw new Error(json?.error || "Falha ao remover disciplina.");
            }
          })
        );

        success("Disciplina removida.");
        const nextDetails = await fetchCourseDetails(selectedCourseId);
        setDetails(nextDetails);
      } catch (e: any) {
        error(e?.message || "Falha ao remover disciplina.");
      }
    },
    [apiEscolaId, details, error, fetchCourseDetails, selectedCourseId, success]
  );

  const openTurmaCleanup = useCallback(
    async (course: ActiveCourse) => {
      setTurmaCleanupCourse(course);
      setTurmaCleanupOpen(true);
      setTurmaCleanupLoading(true);
      setTurmaCleanupSelectedIds([]);
      try {
        const courseDetails = await fetchCourseDetails(course.id);
        setTurmaCleanupItems(courseDetails.turmas ?? []);
      } catch (e: any) {
        setTurmaCleanupOpen(false);
        error(e?.message || "Falha ao carregar turmas do curso.");
      } finally {
        setTurmaCleanupLoading(false);
      }
    },
    [error, fetchCourseDetails]
  );

  const toggleTurmaCleanupSelection = useCallback((turmaId: string) => {
    setTurmaCleanupSelectedIds((prev) =>
      prev.includes(turmaId) ? prev.filter((id) => id !== turmaId) : [...prev, turmaId]
    );
  }, []);

  const runTurmaCleanup = useCallback(async () => {
    if (!apiEscolaId) {
      error("Escola não identificada.");
      return;
    }
    if (!turmaCleanupCourse || turmaCleanupSelectedIds.length === 0) return;
    const selectedSet = new Set(turmaCleanupSelectedIds);
    const blocked = turmaCleanupItems.filter(
      (turma) => selectedSet.has(turma.id) && turma.total_alunos > 0
    );
    if (blocked.length > 0) {
      error("Há turmas selecionadas com alunos ativos. Desmarque essas turmas para continuar.");
      return;
    }

    setTurmaCleanupRunning(true);
    try {
      const results = await Promise.allSettled(
        turmaCleanupSelectedIds.map(async (turmaId) => {
          const res = await fetch(`/api/escolas/${apiEscolaId}/turmas/${turmaId}/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json?.ok === false) {
            throw new Error(json?.error || "Falha ao excluir turma.");
          }
          return turmaId;
        })
      );

      const removed = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (removed > 0) {
        success(`${removed} turma(s) excluída(s) com sucesso.`);
      }
      if (failed > 0) {
        warning(
          "Algumas turmas não foram excluídas",
          `${failed} exclusão(ões) falharam. Revise permissões e vínculos restantes.`
        );
      }

      const refreshedDetails = await fetchCourseDetails(turmaCleanupCourse.id);
      setTurmaCleanupItems(refreshedDetails.turmas ?? []);
      setTurmaCleanupSelectedIds([]);
      fetchCourses();

      if (selectedCourseId === turmaCleanupCourse.id) {
        setDetails(refreshedDetails);
      }
    } catch (e: any) {
      error(e?.message || "Falha ao excluir turmas selecionadas.");
    } finally {
      setTurmaCleanupRunning(false);
    }
  }, [
    error,
    apiEscolaId,
    fetchCourseDetails,
    fetchCourses,
    selectedCourseId,
    success,
    turmaCleanupCourse,
    turmaCleanupItems,
    turmaCleanupSelectedIds,
    warning,
  ]);

  // -------- Manager view --------
  if (resolvePendenciasRequested && (loadingCourses || loadingDetails || !selectedCourseId || !details)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 animate-pulse">
        Preparando pendências do currículo...
      </div>
    );
  }

  if (selectedCourseId) {
    return (
      <>
        <CourseManager
          selectedCourse={selectedCourse}
          managerTab={managerTab}
          loadingDetails={loadingDetails}
          loadingAvaliacao={loadingAvaliacao}
          details={details}
          curriculoInfo={
            selectedCourseId ? curriculoStatusByCurso[selectedCourseId] : undefined
          }
          curriculoAnoLetivo={curriculoAnoLetivo}
          courseAvaliacao={courseAvaliacao}
          onUpdateAvaliacao={handleUpdateAvaliacao}
          onTabChange={setManagerTab}
          onGenerateTurmas={handleAddTurma}
          generatingTurmas={selectedCourseId ? preparingCourseId === selectedCourseId : false}
          onCreateDisciplina={openCreateDisciplina}
          onEditDisciplina={openEditDisciplina}
          onDeleteDisciplina={handleDeleteDisciplina}
          onResolvePendencias={handleResolvePendencias}
          onBack={() => {
            setSelectedCourseId(null);
            setDetails(null);
          }}
        />
        {details && (
          <DisciplinaModal
            open={disciplinaModalOpen}
            mode={disciplinaModalMode}
            initial={disciplinaEditing}
            existingCodes={details.disciplinas.map((d) => d.codigo)}
            existingNames={details.disciplinas.map((d) => d.nome)}
            existingDisciplines={details.disciplinas.map((d) => ({ id: d.id, nome: d.nome }))}
            avaliacaoModelos={courseAvaliacao?.modelos?.map((modelo) => ({ id: modelo.id, nome: modelo.nome })) ?? []}
            classOptions={details.classes}
            pendingDisciplines={resolvePendencias ? pendingDisciplines.map((d) => ({ id: d.id, nome: d.nome })) : []}
            onSelectPending={(id) => {
              const next = pendingDisciplines.find((disc) => disc.id === id);
              if (next) openEditDisciplina(next, true);
            }}
            onClose={() => {
              setResolvePendencias(false);
              setDisciplinaModalOpen(false);
            }}
            onSave={handleSaveDisciplina}
            onDelete={disciplinaModalMode === "edit" ? handleDeleteDisciplina : undefined}
          />
        )}
      </>
    );
  }

  // -------- Default view (tabs) --------
  return (
    <div className="space-y-6">
      <Alert className="bg-klasse-gold-50 border-klasse-gold-200 text-klasse-gold-800">
        <Info className="h-4 w-4 text-klasse-gold-600" />
        <AlertTitle className="text-sm font-semibold">Dica Angola</AlertTitle>
        <AlertDescription className="text-xs text-klasse-gold-700">
          No ensino médio, algumas disciplinas só existem em certas classes (ex.: Filosofia apenas na 12ª).
          Edite por classe e use trimestres para refletir a realidade.
        </AlertDescription>
      </Alert>

      <Tabs
        defaultValue="my_courses"
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ActiveTab)}
        className="w-full"
      >
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="my_courses" className="rounded-full px-6">
            Cursos ativos
          </TabsTrigger>
          <TabsTrigger value="catalog" className="rounded-full px-6">
            Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my_courses" className="mt-6">
          {loadingCourses ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <UISpinner size={24} className="text-slate-400" />
              <p className="text-sm text-slate-500 animate-pulse">Carregando seus cursos...</p>
            </div>
          ) : courses.length === 0 ? (
            <Card className="border-dashed border-2 bg-slate-50/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-slate-100 p-4 mb-4">
                  <Settings className="w-8 h-8 text-slate-400" />
                </div>
                <CardTitle className="text-lg">Nenhum curso ativo</CardTitle>
                <CardDescription className="max-w-xs mt-2">
                  Você ainda não possui cursos configurados. Explore o catálogo para instalar um preset ou crie um do zero.
                </CardDescription>
                <Button
                  onClick={() => setActiveTab("catalog")}
                  tone="gold"
                  className="mt-6 rounded-full"
                >
                  Ir ao catálogo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {courses.map((curso) => (
                <CourseCard
                  key={curso.id}
                  curso={curso}
                  curriculoStatus={getCourseCurriculoStatus(curso.id)}
                  isPreparing={preparingCourseId === curso.id}
                  onOpen={() => handleOpenManager(curso.id)}
                  onPrepareTurmas={() => handleAddTurma(curso.id)}
                  onCleanup={() => openTurmaCleanup(curso)}
                  onRemove={() => handleRemoveCourse(curso.id, curso.total_alunos)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Catálogo de Cursos</h3>
              <p className="text-sm text-slate-500">Selecione um currículo pré-definido para começar rapidamente.</p>
            </div>
            <Button
              onClick={openCustomConfig}
              tone="slate"
              className="rounded-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar do zero
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {presetsList.map((preset) => {
              const isInstalled = courses.some(
                (c) => c.nome.toLowerCase() === preset.label.toLowerCase()
              );
              const tipo: CourseType =
                PRESET_TO_TYPE[preset.key] ??
                (Object.keys(TYPE_COLORS)[0] as CourseType);
              const colors =
                TYPE_COLORS[tipo] ??
                (Object.values(TYPE_COLORS)[0] as {
                  bgLight: string;
                  border: string;
                  text: string;
                });

              return (
                <Card
                  key={preset.key}
                  className={cx(
                    "transition-all duration-200 hover:shadow-md",
                    isInstalled ? "opacity-75 grayscale-[0.5]" : ""
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={cx(
                          "h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-bold border shadow-sm",
                          isInstalled ? "bg-slate-100 border-slate-200 text-slate-400" : `${colors.bgLight} ${colors.text} ${colors.border}`
                        )}
                      >
                        {preset.label?.[0] ?? "C"}
                      </div>
                      <div>
                        <CardTitle className="text-base">{preset.label}</CardTitle>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                          {getTypeLabel(tipo)}
                        </p>
                      </div>
                    </div>
                    {isInstalled && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
                        <Check className="w-3 h-3 mr-1" />
                        Instalado
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                      {preset.description || "Currículo oficial estruturado com disciplinas e classes padrão."}
                    </p>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    {isInstalled ? (
                      <Button
                        variant="outline"
                        fullWidth
                        onClick={() => {
                          const existing = courses.find(c => c.nome.toLowerCase() === preset.label.toLowerCase());
                          if (existing) handleOpenManager(existing.id);
                        }}
                        className="rounded-full"
                      >
                        Gerir curso
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => handleQuickInstall(preset.key)}
                          loading={quickInstallingKey === preset.key}
                          className="rounded-full"
                        >
                          Instalar padrão
                        </Button>
                        <Button
                          fullWidth
                          tone="gold"
                          onClick={() => void openPresetConfig(preset.key)}
                          className="rounded-full"
                        >
                          Configurar
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create course modal */}
      {showModal && draft && (
        <CourseCreateModal
          draft={draft}
          allClasses={ALL_CLASSES}
          installing={installing}
          onClose={() => setShowModal(false)}
          onChangeLabel={(label) =>
            setDraft((prev) => (prev ? { ...prev, label } : prev))
          }
          onToggleClass={toggleClass}
          onAddDisciplina={handleAddDisciplina}
          onRemoveDisciplina={handleRemoveDisciplina}
          onSave={handleSave}
        />
      )}

      {/* Confirm Dialog */}
      {confirmState.open && (
        <ConfirmDialog
          title={confirmState.title}
          desc={confirmState.desc}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onCancel={closeConfirm}
          onConfirm={() => confirmState.onConfirm?.()}
        />
      )}

      {turmaCleanupOpen && (
        <TurmaCleanupModal
          open={turmaCleanupOpen}
          courseName={turmaCleanupCourse?.nome ?? ""}
          items={turmaCleanupItems}
          selectedIds={turmaCleanupSelectedIds}
          loading={turmaCleanupLoading}
          running={turmaCleanupRunning}
          onToggle={toggleTurmaCleanupSelection}
          onClose={() => {
            if (turmaCleanupRunning) return;
            setTurmaCleanupOpen(false);
            setTurmaCleanupItems([]);
            setTurmaCleanupSelectedIds([]);
            setTurmaCleanupCourse(null);
          }}
          onConfirm={runTurmaCleanup}
        />
      )}

    </div>
  );
}

// ---------- Subcomponents ----------
function CourseCard({
  curso,
  curriculoStatus,
  isPreparing,
  onOpen,
  onPrepareTurmas,
  onCleanup,
  onRemove,
}: {
  curso: ActiveCourse;
  curriculoStatus: CurriculoStatus["status"] | "none";
  isPreparing: boolean;
  onOpen: () => void;
  onPrepareTurmas: () => void;
  onCleanup: () => void;
  onRemove: () => void;
}) {
  const needsTurmas = curso.total_classes > 0 && curso.total_turmas === 0;
  const canPrepareTurmas = curriculoStatus === "published";

  return (
    <Card className="flex flex-col h-full transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
            <CardTitle className="text-base truncate">{curso.nome}</CardTitle>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1 truncate">{curso.codigo}</p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCleanup}
            className="h-8 w-8 text-slate-400 hover:text-slate-900"
            title="Excluir turmas excedentes"
          >
            <Eraser className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-slate-400 hover:text-red-600"
            title="Remover curso"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-grow">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Classes</p>
            <p className="text-xl font-bold text-slate-900">{curso.total_classes}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Turmas</p>
            <p className="text-xl font-bold text-slate-900">{curso.total_turmas}</p>
          </div>
        </div>

        {needsTurmas && (
          <div
            className={cx(
              "rounded-xl border p-4 mb-4",
              canPrepareTurmas
                ? "border-klasse-gold-200 bg-klasse-gold-50/50"
                : "border-slate-200 bg-slate-50/50"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">
                  {canPrepareTurmas ? "Falta preparar turmas" : "Currículo pendente"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  {canPrepareTurmas
                    ? "Estrutura publicada. Crie as turmas iniciais para liberar matrículas."
                    : "O currículo deste curso ainda não foi finalizado."}
                </p>
              </div>
            </div>
            {canPrepareTurmas && (
              <Button
                size="sm"
                tone="gold"
                fullWidth
                onClick={onPrepareTurmas}
                loading={isPreparing}
                className="mt-3 rounded-full h-8 text-xs"
              >
                Preparar agora
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          fullWidth
          tone="slate"
          onClick={onOpen}
          className="rounded-full shadow-sm"
        >
          Gerir turmas e currículo
        </Button>
      </CardFooter>
    </Card>
  );
}

function TurmaCleanupModal({
  open,
  courseName,
  items,
  selectedIds,
  loading,
  running,
  onToggle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  courseName: string;
  items: TurmaCleanupItem[];
  selectedIds: string[];
  loading: boolean;
  running: boolean;
  onToggle: (turmaId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const selectedSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const blockedCount = items.filter((turma) => turma.total_alunos > 0).length;
  const canConfirm = selectedCount > 0 && !running;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Excluir turmas excedentes</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Curso: <span className="font-bold text-slate-700">{courseName || "—"}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={running} className="rounded-full h-8 w-8 text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <Alert className="bg-blue-50 border-blue-100 text-blue-800 py-3">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs font-medium">
              Selecione apenas as turmas que foram criadas por engano. Turmas com alunos ativos (<Users className="inline w-3 h-3 mb-0.5" />) não podem ser excluídas por segurança.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="py-12 flex justify-center">
              <UISpinner size={24} className="text-slate-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
              <p className="text-sm text-slate-400">Nenhuma turma encontrada para este curso.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-inner">
              {items.map((turma) => {
                const blocked = turma.total_alunos > 0;
                const isSelected = selectedSet.has(turma.id);
                return (
                  <label
                    key={turma.id}
                    className={cx(
                      "flex items-center justify-between gap-4 px-5 py-4 transition-colors cursor-pointer",
                      blocked ? "bg-rose-50/30 opacity-60 grayscale-[0.5] cursor-not-allowed" : "bg-white hover:bg-slate-50",
                      isSelected && !blocked ? "bg-slate-50" : ""
                    )}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isSelected ? "bg-slate-900 border-slate-900" : "bg-white border-slate-300",
                        blocked ? "opacity-50" : ""
                      )}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => onToggle(turma.id)}
                          disabled={blocked || running}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{turma.nome}</p>
                        <p className="text-[11px] text-slate-500 truncate font-medium uppercase tracking-wider">
                          {turma.classe} · {turma.turno}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={blocked ? "destructive" : "outline"} className={cx("font-bold text-[10px]", !blocked && "text-slate-500 border-slate-200")}>
                        <Users className="w-3 h-3 mr-1" />
                        {turma.total_alunos} {turma.total_alunos === 1 ? "aluno" : "alunos"}
                      </Badge>
                      {blocked && <p className="text-[9px] text-red-600 font-bold uppercase mt-1 tracking-tighter">Bloqueada</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              {selectedCount} selecionadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {blockedCount} bloqueadas
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={running}
              className="rounded-full px-6 h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!canConfirm}
              loading={running}
              tone="red"
              className="rounded-full px-8 h-10 shadow-md"
            >
              Excluir selecionadas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
