"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Trash2, Check, Settings, Plus } from "lucide-react";
import { toast } from "sonner";

import { CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/onboarding";
import { CURRICULUM_PRESETS } from "@/lib/onboarding";
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
};

export type CourseDetails = {
  id: string;
  disciplinas: {
    id: string;
    nome: string;
    codigo: string;
    carga_horaria_semanal: number;
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
    class_ids?: string[];
    matrix_by_class?: Record<string, string[]>;
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
  const searchParams = useSearchParams();
  const resolvePendenciasRequested = searchParams?.get("resolvePendencias") === "1";
  const [activeTab, setActiveTab] = useState<ActiveTab>("my_courses");
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Manager
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [managerTab, setManagerTab] = useState<ManagerTab>("turmas");
  const [details, setDetails] = useState<CourseDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [curriculoStatusByCurso, setCurriculoStatusByCurso] = useState<Record<string, CurriculoStatus>>({});
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
      toast.error(e?.message || "Erro ao carregar cursos.");
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
        const map: Record<string, CurriculoStatus> = {};
        (json.curriculos ?? []).forEach((row: CurriculoStatus) => {
          map[row.curso_id] = row;
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

      const disciplinaMap = new Map<string, CourseDetails["disciplinas"][number]>();
      (disciplinasJson?.data ?? []).forEach((item: any) => {
        const key = item.disciplina_id ?? item.nome ?? item.id;
        const existing = disciplinaMap.get(key);
        const incomingStatus = item.curriculo_status ?? null;
        const base = existing ?? {
          id: key,
          nome: item.nome,
          codigo: item.sigla ?? item.codigo ?? item.nome?.slice(0, 6)?.toUpperCase() ?? "",
          carga_horaria_semanal: Number(item.carga_horaria_semanal ?? item.carga_horaria ?? 0),
          is_core: Boolean(item.is_core ?? (item.classificacao === "core" || item.tipo === "core")),
          participa_horario: item.entra_no_horario ?? true,
          is_avaliavel: item.is_avaliavel ?? true,
          avaliacao_mode: item.avaliacao_mode === "custom" ? "personalizada" : "herdar_escola",
          area: item.area ?? null,
          classificacao: item.classificacao ?? null,
          periodos_ativos: item.periodos_ativos ?? null,
          entra_no_horario: item.entra_no_horario ?? null,
          avaliacao_mode_key: item.avaliacao_mode ?? null,
          avaliacao_disciplina_id: item.avaliacao_disciplina_id ?? null,
          status_completude: item.status_completude ?? null,
          curriculo_status: incomingStatus,
          matrix_ids: [] as string[], // Explicitly cast to string[]
          class_ids: [] as string[],
          matrix_by_class: {} as Record<string, string[]>,
        };

        const shouldReplace =
          existing && incomingStatus === "draft" && existing.curriculo_status !== "draft";
        const nextBase = shouldReplace ? { ...base, matrix_ids: [] as string[] } : base;

        const matrixIds = nextBase.matrix_ids ?? [];
        if (item.id && !matrixIds.includes(item.id as string)) {
          matrixIds.push(item.id as string);
        }

        const classId = item.classe_id as string | undefined;
        const classIds = nextBase.class_ids ?? [];
        const matrixByClass = nextBase.matrix_by_class ?? {};
        if (classId) {
          if (!classIds.includes(classId)) classIds.push(classId);
          const classMatrixIds = matrixByClass[classId] ?? [];
          if (item.id && !classMatrixIds.includes(item.id as string)) {
            classMatrixIds.push(item.id as string);
          }
          matrixByClass[classId] = classMatrixIds;
        }

        disciplinaMap.set(key, {
          ...nextBase,
          matrix_ids: matrixIds,
          class_ids: classIds,
          matrix_by_class: matrixByClass,
        });
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
    [escolaId]
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
        toast.error(e?.message || "Erro ao carregar detalhes do curso.");
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
        const res = await fetch(`/api/escolas/${escolaId}/disciplinas?status_completude=incompleto&limit=1`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        const first = json?.data?.[0];
        const targetCourseId = first?.curso_id ?? courses[0]?.id;
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
  }, [autoResolveTriggered, courses, escolaId, handleOpenManager, loadingCourses, searchParams]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  // -------- CRUD (UI-safe stubs, sem prompt/confirm) --------
  const handleAddTurma = useCallback(
    async (cursoId: string) => {
      const curriculo = curriculoStatusByCurso[cursoId];
      if (!curriculo || curriculo.status !== "published") {
        toast.error("Publique o currículo antes de gerar turmas.");
        return;
      }
      if (!curriculoAnoLetivo?.ano) {
        toast.error("Ano letivo ativo não encontrado.");
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
            toast.success("Turmas geradas com sucesso.");
          } catch (e: any) {
            toast.error(e?.message || "Falha ao gerar turmas.");
          }
        },
      });
    },
    [curriculoAnoLetivo, curriculoStatusByCurso, escolaId]
  );

  // -------- Presets helpers --------
  const extractSubjectsFromPreset = useCallback(
    (key: CurriculumKey): DraftDisciplina[] => {
      const data: any = CURRICULUM_PRESETS[key];
      let subjects: string[] = [];
      if (Array.isArray(data)) subjects = data.map((d) => (typeof d === "string" ? d : d.nome));
      else if (data) subjects = data.subjects || [];
      return Array.from(new Set(subjects)).map((nome) => buildDraftDisciplina(nome));
    },
    [buildDraftDisciplina]
  );

  const presetsList = useMemo(() => {
    return Object.entries(CURRICULUM_PRESETS_META).map(([k, m]) => {
      const { key: _omit, ...rest } = m as any;
      return { key: k as CurriculumKey, ...rest };
    });
  }, []);

  const openPresetConfig = useCallback(
    (presetKey: string) => {
      const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
      const subjects = extractSubjectsFromPreset(presetKey as CurriculumKey);
      const classes =
        meta?.classes && meta.classes.length > 0
          ? [...meta.classes]
          : ["10ª Classe", "11ª Classe", "12ª Classe"];

      setDraft({
        label: meta?.label || "Novo Curso",
        classes,
        subjects,
        isCustom: false,
        baseKey: presetKey,
      });
      setShowModal(true);
    },
    [extractSubjectsFromPreset]
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
        toast.error("Já existe.");
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
        toast.success("Instalação concluída.");
        fetchCourses();
      } catch (e: any) {
        toast.error(e?.message || "Falha ao instalar preset.");
      } finally {
        setQuickInstallingKey(null);
      }
    },
    [escolaId, fetchCourses]
  );

  const handleSave = useCallback(async () => {
    if (!draft) return;

    if (!draft.label.trim()) {
      toast.error("Nome do curso é obrigatório.");
      return;
    }
    if (draft.classes.length === 0) {
      toast.error("Selecione ao menos 1 classe.");
      return;
    }
    if (draft.subjects.length === 0) {
      toast.error("Adicione ao menos 1 disciplina.");
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

      toast.success("Curso criado com sucesso.");
      setShowModal(false);
      setDraft(null);
      fetchCourses();
      setActiveTab("my_courses");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar curso.");
    } finally {
      setInstalling(false);
    }
  }, [draft, escolaId, fetchCourses]);

  const handleRemoveCourse = useCallback((id: string, totalAlunos: number) => {
    if (totalAlunos > 0) {
      toast.error("Curso tem alunos vinculados.");
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
          toast.success("Curso removido.");
          fetchCourses();
        } catch (e: any) {
          toast.error(e?.message || "Erro ao remover curso.");
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
            toast.error("Cadastre classes antes de adicionar disciplinas.");
            return;
          }

          const targetClassIds = payload.class_ids?.length
            ? payload.class_ids
            : details.classes.map((classe) => classe.id);
          const targetClasses = details.classes.filter((classe) => targetClassIds.includes(classe.id));
          if (targetClasses.length === 0) {
            toast.error("Selecione ao menos uma classe.");
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
                throw new Error(json?.error || "Falha ao criar disciplina.");
              }
            })
          );

          toast.success("Disciplina criada.");
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
          toast.error("Nenhuma classe selecionada para aplicar alterações.");
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

        toast.success("Disciplina atualizada.");
        const nextDetails = await fetchCourseDetails(selectedCourseId);
        setDetails(nextDetails);
      } catch (e: any) {
        toast.error(e?.message || "Falha ao salvar disciplina.");
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

        toast.success("Disciplina removida.");
        const nextDetails = await fetchCourseDetails(selectedCourseId);
        setDetails(nextDetails);
      } catch (e: any) {
        toast.error(e?.message || "Falha ao remover disciplina.");
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
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("my_courses")}
          className={cx(
            "rounded-full px-4 py-2 text-xs font-semibold border transition",
            activeTab === "my_courses"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          Cursos ativos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={cx(
            "rounded-full px-4 py-2 text-xs font-semibold border transition",
            activeTab === "catalog"
              ? "bg-klasse-gold text-white border-klasse-gold"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
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
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
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
                            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold border",
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
                      <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
                        <Check className="w-4 h-4" />
                        Instalado
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickInstall(preset.key)}
                          disabled={!!quickInstallingKey}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {quickInstallingKey === preset.key ? "Instalando..." : "Instalar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPresetConfig(preset.key)}
                          className="rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white hover:brightness-95"
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
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          title="Remover"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
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
