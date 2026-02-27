"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Trash2, Check, Settings, Plus } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

import { CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/onboarding";
import { usePresetsCatalog, usePresetsMeta } from "@/hooks/usePresetSubjects";
import { createClient } from "@/lib/supabaseClient";
import {
  PRESET_TO_TYPE,
  TYPE_COLORS,
  getTypeLabel,
  type CourseType,
} from "@/lib/courseTypes";

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

type ActiveTab = "my_courses" | "catalog";
type ManagerTab = "turmas" | "disciplinas";

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

function Spinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

// ---------- API layer (thin wrapper) ----------
async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    const msg = json?.error || "Falha na requisição.";
    throw new Error(msg);
  }
  return json.data as T;
}

// ---------- Component ----------
export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { success, error, warning, toast: rawToast } = useToast();
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
  const [curriculoStatusByCurso, setCurriculoStatusByCurso] = useState<Record<string, CurriculoStatus[]>>({});
  const [curriculoAnoLetivo, setCurriculoAnoLetivo] = useState<{ id: string; ano: number } | null>(null);

  // Modal create
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [installing, setInstalling] = useState(false);
  const [quickInstallingKey, setQuickInstallingKey] = useState<string | null>(null);

  const [disciplinaModalOpen, setDisciplinaModalOpen] = useState(false);
  const [disciplinaModalMode, setDisciplinaModalMode] = useState<"create" | "edit">("create");
  const [disciplinaEditing, setDisciplinaEditing] = useState<DisciplinaForm | null>(null);
  const [disciplinaEditingMatrixIds, setDisciplinaEditingMatrixIds] = useState<string[]>([]);
  const [disciplinaEditingMatrixByClass, setDisciplinaEditingMatrixByClass] = useState<Record<string, string[]>>({});
  const [resolvePendencias, setResolvePendencias] = useState(false);
  const [autoResolveTriggered, setAutoResolveTriggered] = useState(false);
  const [autoFocusTriggered, setAutoFocusTriggered] = useState(false);

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
      area: disciplina.area ?? null,
      programa_texto: null,
      class_ids: disciplina.class_ids ?? [],
    });
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
    setLoadingCourses(true);
    const ac = new AbortController();
    try {
      const data = await apiGet<ActiveCourse[]>(
        `/api/escolas/${escolaId}/cursos/stats`,
        ac.signal
      );
      setCourses(data || []);
    } catch (e: any) {
      console.error(e);
      error(e?.message || "Erro ao carregar cursos.");
    } finally {
      setLoadingCourses(false);
    }
    return () => ac.abort();
  }, [escolaId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    let active = true;
    const loadCurriculoStatus = async () => {
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/status`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar status do currículo.");
        }
        if (!active) return;
        const map: Record<string, CurriculoStatus[]> = {};
        (json.curriculos ?? []).forEach((row: CurriculoStatus) => {
          const bucket = map[row.curso_id] ?? [];
          bucket.push(row);
          map[row.curso_id] = bucket;
        });
        setCurriculoStatusByCurso(map);
        setCurriculoAnoLetivo(json.ano_letivo ?? null);
      } catch (e: any) {
        console.warn(e);
      }
    };
    loadCurriculoStatus();
    return () => {
      active = false;
    };
  }, [escolaId]);

  // -------- Details --------
  const fetchCourseDetails = useCallback(
    async (courseId: string): Promise<CourseDetails> => {
      const [classesRes, disciplinasRes, turmasRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/classes?curso_id=${courseId}&limit=50`, {
          cache: "no-store",
        }),
        fetch(`/api/escolas/${escolaId}/disciplinas?curso_id=${courseId}&limit=200`, {
          cache: "no-store",
        }),
        fetch(`/api/escolas/${escolaId}/turmas?curso_id=${courseId}&limit=50`, {
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
    [curriculoAnoLetivo?.id, escolaId]
  );

  const handleOpenManager = useCallback(
    async (courseId: string, tab: ManagerTab = "turmas") => {
      setSelectedCourseId(courseId);
      setManagerTab(tab);
      setLoadingDetails(true);
      setDetails(null);

      try {
        const nextDetails = await fetchCourseDetails(courseId);
        setDetails(nextDetails);
      } catch (e: any) {
        console.error(e);
        error(e?.message || "Erro ao carregar detalhes do curso.");
        setSelectedCourseId(null);
      } finally {
        setLoadingDetails(false);
      }
    },
    [fetchCourseDetails]
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
          const res = await fetch(`/api/escolas/${escolaId}/disciplinas?status_completude=incompleto&limit=1`, {
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
  }, [autoResolveTriggered, courseIdFromQuery, courses, escolaId, handleOpenManager, loadingCourses, searchParams]);

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

  // -------- CRUD (UI-safe stubs, sem prompt/confirm) --------
  const handleAddTurma = useCallback(
    async (cursoId: string) => {
      const curriculos = curriculoStatusByCurso[cursoId] ?? [];
      const hasPublished = curriculos.length > 0 && curriculos.every((c) => c.status === "published");
      if (!hasPublished) {
        error("Publique o currículo antes de gerar turmas.");
        return;
      }
      if (!curriculoAnoLetivo?.ano) {
        error("Ano letivo ativo não encontrado.");
        return;
      }

      setConfirmState({
        open: true,
        title: "Gerar turmas",
        desc: "A geração de turmas usa a factory/ RPC para também criar turma_disciplinas.",
        confirmLabel: "Gerar",
        onConfirm: async () => {
          closeConfirm();
          try {
            const res = await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
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
            fetchCourses();
            success("Turmas geradas com sucesso.");
          } catch (e: any) {
            error(e?.message || "Falha ao gerar turmas.");
          }
        },
      });
    },
    [curriculoAnoLetivo, curriculoStatusByCurso, escolaId, fetchCourseDetails, fetchCourses, selectedCourseId]
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
  }, []);

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
        const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/install-preset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey,
            options: { autoPublish: false, generateTurmas: false },
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao instalar preset.");
        }
        success("Instalação concluída.");
        fetchCourses();
      } catch (e: any) {
        error(e?.message || "Falha ao instalar preset.");
      } finally {
        setQuickInstallingKey(null);
      }
    },
    [escolaId, fetchCourses]
  );

  const handleSave = useCallback(async () => {
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
      if (!draft.isCustom && draft.baseKey in CURRICULUM_PRESETS_META) {
        const subjects = draft.subjects.map((s) => s.nome);
        const turnos = { manha: true, tarde: false, noite: false };
        const matrix: Record<string, boolean> = {};
        for (const subject of subjects) {
          for (const cls of draft.classes) {
            matrix[`${subject}::${cls}::M`] = true;
          }
        }

        const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/install-preset`, {
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
      } else {
        const createRes = await fetch(`/api/escolas/${escolaId}/cursos`, {
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
          const classRes = await fetch(`/api/escolas/${escolaId}/classes`, {
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
            const discRes = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
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
              }),
            });
            const discJson = await discRes.json().catch(() => null);
            if (!discRes.ok || discJson?.ok === false) {
              throw new Error(discJson?.error || "Falha ao criar disciplina.");
            }
          }
        }
      }

      success("Curso criado com sucesso.");
      setShowModal(false);
      setDraft(null);
      fetchCourses();
      setActiveTab("my_courses");
    } catch (e: any) {
      error(e?.message || "Erro ao criar curso.");
    } finally {
      setInstalling(false);
    }
  }, [draft, escolaId, fetchCourses]);

  const handleRemoveCourse = useCallback((id: string, totalAlunos: number) => {
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
          const res = await fetch(`/api/escolas/${escolaId}/cursos/${id}`, {
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
  }, [escolaId, fetchCourses]);

  const handleSaveDisciplina = useCallback(
    async (payload: DisciplinaForm) => {
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
              const res = await fetch(`/api/escolas/${escolaId}/disciplinas`, {
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
                  avaliacao_modelo_id: null,
                  avaliacao_disciplina_id:
                    payload.avaliacao.mode === "inherit_disciplina"
                      ? payload.avaliacao.base_id ?? null
                      : null,
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
            const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
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
      escolaId,
      fetchCourseDetails,
      selectedCourseId,
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

  useEffect(() => {
    if (searchParams?.get("resolvePendencias") !== "1") return;
    if (!selectedCourseId || loadingDetails) return;
    if (!resolvePendencias && pendingDisciplines.length > 0) {
      handleResolvePendencias();
    }
  }, [handleResolvePendencias, loadingDetails, pendingDisciplines.length, resolvePendencias, searchParams, selectedCourseId]);

  const handleDeleteDisciplina = useCallback(
    async (id: string) => {
      if (!details || !selectedCourseId) return;
      const disciplina = details.disciplinas.find((d) => d.id === id);
      const matrixIds = disciplina?.matrix_ids ?? [];
      if (matrixIds.length === 0) return;
      try {
        await Promise.all(
          matrixIds.map(async (matrixId) => {
            const res = await fetch(`/api/escolas/${escolaId}/disciplinas/${matrixId}`, {
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
    [details, escolaId, fetchCourseDetails, selectedCourseId]
  );

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
          details={details}
          curriculoInfo={
            selectedCourseId ? curriculoStatusByCurso[selectedCourseId] : undefined
          }
          curriculoAnoLetivo={curriculoAnoLetivo}
          onTabChange={setManagerTab}
          onGenerateTurmas={handleAddTurma}
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
            escolaId={escolaId}
            cursoId={selectedCourseId}
            open={disciplinaModalOpen}
            mode={disciplinaModalMode}
            initial={disciplinaEditing}
            existingCodes={details.disciplinas.map((d) => d.codigo)}
            existingNames={details.disciplinas.map((d) => d.nome)}
            existingDisciplines={details.disciplinas.map((d) => ({ id: d.id, nome: d.nome }))}
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="font-semibold text-slate-900">Guia de estrutura</p>
        <p className="mt-1 text-xs text-slate-500">
          No ensino médio, algumas disciplinas só existem em certas classes (ex.: Filosofia apenas na 12ª).
          Edite por classe e use trimestres para refletir a realidade.
        </p>
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("my_courses")}
          className={cx(
            "rounded-xl px-4 py-2 text-xs font-semibold border transition-colors",
            activeTab === "my_courses"
              ? "bg-slate-900 text-klasse-gold border-slate-900 ring-1 ring-klasse-gold/25"
              : "bg-white text-slate-700 border-slate-200 hover:text-klasse-gold"
          )}
        >
          Cursos ativos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={cx(
            "rounded-xl px-4 py-2 text-xs font-semibold border transition-colors",
            activeTab === "catalog"
              ? "bg-slate-900 text-klasse-gold border-slate-900 ring-1 ring-klasse-gold/25"
              : "bg-white text-slate-700 border-slate-200 hover:text-klasse-gold"
          )}
        >
          Catálogo
        </button>
      </div>

      {/* My courses */}
      {activeTab === "my_courses" && (
        <div>
          {loadingCourses ? (
            <div className="py-12 flex justify-center">
              <Spinner label="Carregando cursos..." />
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">Nenhum curso ativo</p>
              <p className="text-xs text-slate-500 mt-1">Instale um preset no catálogo.</p>
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
              >
                <Settings className="w-4 h-4" />
                Ir ao catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((curso) => (
                <CourseCard
                  key={curso.id}
                  curso={curso}
                  onOpen={() => handleOpenManager(curso.id)}
                  onRemove={() => handleRemoveCourse(curso.id, curso.total_alunos)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCustomConfig}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:text-klasse-gold"
            >
              <Plus className="w-4 h-4" />
              Criar do zero
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div
                  key={preset.key}
                  className={cx(
                    "rounded-xl border p-5 bg-white",
                    isInstalled ? "border-slate-200 opacity-70" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={cx(
                            "h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold border",
                            isInstalled ? "bg-slate-100 border-slate-200 text-slate-500" : `${colors.bgLight} ${colors.text} ${colors.border}`
                          )}
                        >
                          {preset.label?.[0] ?? "C"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {preset.label}
                          </p>
                          <p className="text-xs text-slate-500">{getTypeLabel(tipo)}</p>
                        </div>
                      </div>
                    </div>

                    {isInstalled ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                        <Check className="w-4 h-4" />
                        Instalado
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickInstall(preset.key)}
                          disabled={!!quickInstallingKey}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:text-klasse-gold disabled:opacity-60"
                        >
                          {quickInstallingKey === preset.key ? "Instalando..." : "Instalar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openPresetConfig(preset.key)}
                          className="rounded-xl bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
                        >
                          Configurar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

    </div>
  );
}

// ---------- Subcomponents ----------
function CourseCard({
  curso,
  onOpen,
  onRemove,
}: {
  curso: ActiveCourse;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-klasse-gold/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-900 truncate">{curso.nome}</p>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1 truncate">{curso.codigo}</p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-red-200 hover:text-red-600"
          title="Remover"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
          <span className="hidden sm:inline">Remover</span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-slate-500">Classes</p>
          <p className="text-sm font-semibold text-slate-900">{curso.total_classes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-slate-500">Turmas</p>
          <p className="text-sm font-semibold text-slate-900">{curso.total_turmas}</p>
        </div>
      </div>
    </div>
  );
}
