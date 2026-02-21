"use client";

import { useState, useEffect, useRef } from "react";
import {
  Layers,
  BookOpen,
  Sun,
  CloudSun,
  Moon,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  PlusCircle,
  X,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  CURRICULUM_PRESETS,
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/onboarding";
import {
  TYPE_ICONS,
  TYPE_COLORS,
  getCourseIcon,
  getTypeLabel,
  PRESET_TO_TYPE,
  type CourseType,
} from "@/lib/courseTypes";

// ------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------

const ALL_CLASSES = [
  "1ª Classe",
  "2ª Classe",
  "3ª Classe",
  "4ª Classe",
  "5ª Classe",
  "6ª Classe",
  "7ª Classe",
  "8ª Classe",
  "9ª Classe",
  "10ª Classe",
  "11ª Classe",
  "12ª Classe",
  "13ª Classe",
] as const;

type BuilderTurnoKey = "manha" | "tarde" | "noite";

type BuilderTurnos = {
  manha: boolean;
  tarde: boolean;
  noite: boolean;
};

const CATEGORIES = [
  { id: "geral", label: "Ensino Geral", icon: BookOpen },
  { id: "tecnico", label: "Ensino Técnico", icon: Wrench },
  { id: "custom", label: "Personalizados", icon: PlusCircle },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

type TrackFilter = CourseType | "all" | null;

const TRACK_OPTIONS: {
  id: CourseType;
  label: string;
  description: string;
}[] = [
  {
    id: "puniv",
    label: "Curso PUNIV / II Ciclo",
    description: "Alinhado aos currículos gerais de Ciências",
  },
  {
    id: "tecnico",
    label: "Curso Técnico & Profissional",
    description: "Modelos técnicos e de saúde do currículo oficial",
  },
];

type MatrixKey = string; // "Disciplina::10ª::M"

// Custom course salvo localmente (UX)
type CustomCourse = {
  key: string;
  label: string;
  associatedPreset: CurriculumKey;
  classes: string[];
  subjects: string[];
};

// Estado interno do configurador
interface BuilderConfig {
  presetKey: CurriculumKey | null;         // preset oficial escolhido no passo 1
  label: string;                           // nome do curso (oficial ou custom)
  tipo: CourseType | null;                 // tipo forte (primario, ciclo1, puniv, tecnico, geral)
  classes: string[];                       // ["10ª", "11ª", ...]
  subjects: string[];                      // lista de disciplinas definidas na UI
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;      // "disc::classe::M/T/N"
  isCustom: boolean;                       // se veio de custom ou preset oficial
  associatedPreset?: CurriculumKey;        // para custom: preset-base escolhido
}

// Payload que vamos mandar para a API
interface AdvancedConfigPayload {
  classes: string[];
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;
  subjects: string[];
  cargaByClass?: Record<string, number>;
}

interface CustomDataPayload {
  label: string;
  associatedPreset: CurriculumKey;
  classes: string[];
  subjects: string[];
}

interface CurriculumApplyPayload {
  presetKey: CurriculumKey;
  ano_letivo_id?: string | null;
  customData?: CustomDataPayload;
  advancedConfig: AdvancedConfigPayload;
}

// Helper seguro: preset → CourseType
const getSafeTypeFromPreset = (key: string): CourseType => {
  return PRESET_TO_TYPE[key] || "geral";
};

const normalizeClassLabel = (cls: string): string => {
  const trimmed = cls.trim();
  return /classe$/i.test(trimmed) ? trimmed : `${trimmed} Classe`;
};

const getSubjectsFromPreset = (key: CurriculumKey | null): string[] => {
  if (!key) return [];
  const blueprint = CURRICULUM_PRESETS[key];
  if (!blueprint) return [];

  const seen = new Set<string>();
  const ordered: string[] = [];

  blueprint.forEach((item) => {
    if (!seen.has(item.nome)) {
      seen.add(item.nome);
      ordered.push(item.nome);
    }
  });

  return ordered;
};

function CourseTypeIcon({
  type,
  className,
}: {
  type: CourseType | null;
  className?: string;
}) {
  const Icon = (type && TYPE_ICONS[type]) || BookOpen;
  return <Icon className={className} />;
}

// ------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------

export default function CurriculumBuilder({
  escolaId,
  sessionId, // opcional, se você quiser já linkar turmas à sessão
  onComplete,
  onCancel,
  initialPresetKey,
}: {
  escolaId: string;
  sessionId?: string | null;
  onComplete?: () => void;
  onCancel?: () => void;
  initialPresetKey?: CurriculumKey | null;
}) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<CategoryId>("geral");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(null);
  const [customCourses, setCustomCourses] = useState<CustomCourse[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const subjectsScrollRef = useRef<HTMLDivElement | null>(null);

  const [config, setConfig] = useState<BuilderConfig>({
    presetKey: null,
    label: "",
    tipo: null,
    classes: [],
    turnos: { manha: false, tarde: false, noite: false },
    subjects: [],
    matrix: {},
    isCustom: false,
    associatedPreset: undefined,
  });
  const hasSubjects = config.subjects.length > 0;
  const subjectsVirtualizer = useVirtualizer({
    count: config.subjects.length,
    getScrollElement: () => subjectsScrollRef.current,
    estimateSize: () => 56,
    overscan: 6,
  });

  // ------------------------------------------------------
  // Carregar cursos customizados do localStorage
  // ------------------------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem(`moxi_custom_courses_${escolaId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as CustomCourse[];
      setCustomCourses(parsed);
    } catch (e) {
      console.error("Erro ao carregar cursos customizados:", e);
    }
  }, [escolaId]);

  // ------------------------------------------------------
  // Helpers de lista para as categorias
  // ------------------------------------------------------
  const getPresetsByCategory = (catId: CategoryId) => {
    const matchesTrack = (preset: any) => {
      if (!trackFilter || trackFilter === "all") return true;

      const baseKey: string =
        (preset.isCustom && preset.associatedPreset) || preset.key;

      return getSafeTypeFromPreset(baseKey) === trackFilter;
    };

    if (catId === "custom") {
      return customCourses
        .map((c) => ({
          key: c.key,
          label: c.label,
          classes: c.classes,
          subjects: c.subjects,
          isCustom: true,
          associatedPreset: c.associatedPreset,
        }))
        .filter(matchesTrack);
    }

    const keysForCat: CurriculumKey[] =
      (catId === "geral"
        ? ([
            "primario_generico",
            "esg_ciclo1",
            "esg_puniv_cfb",
            "esg_puniv_cej",
            "esg_puniv_cch",
            "esg_puniv_artes",
          ] as CurriculumKey[])
        : ([
            "tec_contabilidade",
            "tec_informatica_gestao",
            "tec_recursos_humanos",
            "tec_secretariado",
            "tec_financas",
            "tec_comercio",
            "tec_saude_analises",
            "tec_saude_enfermagem",
            "tec_saude_estomatologia",
            "tec_saude_farmacia",
            "tec_saude_fisioterapia",
            "tec_saude_nutricao",
            "tec_saude_radiologia",
            "tec_construcao_civil",
            "tec_energia_eletrica",
            "tec_mecanica_manut",
            "tec_informatica_sistemas",
            "tec_desenhador_projectista",
            "tec_electronica_telecom",
            "tec_electronica_automacao",
            "tec_energias_renovaveis",
            "tec_geologia_petroleo",
            "tec_perfuracao_producao",
            "tec_minas",
            "tec_producao_metalomecanica",
            "tec_informatica",
            "tec_gestao_sistemas",
          ] as CurriculumKey[]));

    return keysForCat
      .map((key) => {
        // ensure we don't duplicate the `key` property if the meta already includes it
        const meta = CURRICULUM_PRESETS_META[key] || {};
        const { key: _maybeKey, ...rest } = meta as any;
        return { key, ...rest, isCustom: false };
      })
      .filter(Boolean)
      .filter(matchesTrack);
  };

  const handleTrackSelect = (value: TrackFilter) => {
    setTrackFilter(value);

    if (value === "tecnico") setCategory("tecnico");
    else if (value === "puniv") setCategory("geral");
  };

  // Ícone + cores de um "preset visual" (oficial ou custom)
  const getPresetStyle = (preset: any) => {
    const baseKey: string =
      (preset.isCustom && preset.associatedPreset) || preset.key;

    const tipo: CourseType =
      preset.tipo ||
      (baseKey ? getSafeTypeFromPreset(baseKey) : ("geral" as CourseType));

    const icon =
      preset.isCustom && preset.label
        ? getCourseIcon(preset.label, tipo)
        : TYPE_ICONS[tipo] || BookOpen;

    const colors = TYPE_COLORS[tipo] || TYPE_COLORS.geral;

    return { icon, colors, tipo };
  };

  // ------------------------------------------------------
  // AÇÕES
  // ------------------------------------------------------

  const handleSelectPreset = (preset: any, isCustom: boolean) => {
    const presetKey = (preset.key || null) as CurriculumKey | null;
    const baseKey: string =
      (isCustom && preset.associatedPreset) || preset.key;

    const tipo = getSafeTypeFromPreset(baseKey);
    const meta =
      !isCustom && preset.key
        ? CURRICULUM_PRESETS_META[preset.key as CurriculumKey]
        : null;

    const label: string =
      preset.label ||
      preset.nome ||
      meta?.label ||
      preset.curso_nome ||
      "";

    // classes padrão:
    const defaultClasses: string[] =
      (preset.classes || meta?.classes || []).map(normalizeClassLabel);

    const subjects: string[] =
      isCustom && preset.subjects
        ? preset.subjects
        : getSubjectsFromPreset(presetKey);

    setConfig({
      presetKey: presetKey,
      label,
      tipo,
      classes: defaultClasses,
      turnos: { manha: false, tarde: false, noite: false },
      subjects,
      matrix: {}, // será inicializada quando entrar na etapa 4
      isCustom,
      associatedPreset: isCustom
        ? (preset.associatedPreset as CurriculumKey)
        : (preset.key as CurriculumKey),
    });
  };

  useEffect(() => {
    if (!initialPresetKey) return;
    if (config.presetKey === initialPresetKey) return;

    const meta = CURRICULUM_PRESETS_META[initialPresetKey];
    const subjects = getSubjectsFromPreset(initialPresetKey);

    handleTrackSelect(getSafeTypeFromPreset(initialPresetKey));

    handleSelectPreset(
      {
        key: initialPresetKey,
        label: meta?.label,
        classes: (meta?.classes || []).map(normalizeClassLabel),
        subjects,
      },
      false
    );
  }, [initialPresetKey, config.presetKey]);

  const toggleClass = (cls: string) => {
    setConfig((prev) => {
      const has = prev.classes.includes(cls);
      const newClasses = has
        ? prev.classes.filter((c) => c !== cls)
        : [...prev.classes, cls];

      // manter na ordem do ALL_CLASSES
      newClasses.sort(
        (a, b) =>
          ALL_CLASSES.indexOf(a as (typeof ALL_CLASSES)[number]) -
          ALL_CLASSES.indexOf(b as (typeof ALL_CLASSES)[number])
      );

      return { ...prev, classes: newClasses };
    });
  };

  const toggleTurno = (key: BuilderTurnoKey) => {
    setConfig((prev) => ({
      ...prev,
      turnos: { ...prev.turnos, [key]: !prev.turnos[key] },
    }));
  };

  const toggleMatrixCell = (subject: string, cls: string, turnoKey: string) => {
    const k: MatrixKey = `${subject}::${cls}::${turnoKey}`;
    setConfig((prev) => ({
      ...prev,
      matrix: { ...prev.matrix, [k]: !prev.matrix[k] },
    }));
  };

  const handleAddSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (config.subjects.includes(trimmed)) {
      setNewSubject("");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      subjects: [...prev.subjects, trimmed],
    }));
    setNewSubject("");
  };

  // Inicializa a matriz quando sai do step 3 → 4
  const initMatrixIfNeeded = () => {
    if (Object.keys(config.matrix).length > 0) return;
    if (config.subjects.length === 0) return;

    const newMatrix: Record<MatrixKey, boolean> = {};
    config.subjects.forEach((subj) => {
      config.classes.forEach((cls) => {
        if (config.turnos.manha) newMatrix[`${subj}::${cls}::M`] = true;
        if (config.turnos.tarde) newMatrix[`${subj}::${cls}::T`] = true;
        if (config.turnos.noite) newMatrix[`${subj}::${cls}::N`] = true;
      });
    });
    setConfig((prev) => ({ ...prev, matrix: newMatrix }));
  };

  const handleNext = () => {
    if (step === 1 && !config.presetKey) {
      toast.error("Selecione um curso ou crie um personalizado.");
      return;
    }
    if (step === 2 && config.classes.length === 0) {
      toast.error("Selecione pelo menos uma classe.");
      return;
    }
    if (
      step === 3 &&
      !config.turnos.manha &&
      !config.turnos.tarde &&
      !config.turnos.noite
    ) {
      toast.error("Selecione pelo menos um turno.");
      return;
    }

    if (step === 3) {
      // indo para step 4: inicializar matriz
      initMatrixIfNeeded();
    }

    setStep((s) => Math.min(4, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFinish = async () => {
    if (!config.presetKey) {
      toast.error("Configuração inválida: preset principal não definido.");
      return;
    }
    if (config.isCustom && !config.associatedPreset) {
      toast.error("Configuração inválida: preset associado para curso customizado não definido.");
      return;
    }
    if (config.classes.length === 0) {
      toast.error("Selecione pelo menos uma classe.");
      return;
    }

    // Payload consistente com o que o backend espera
    const advancedConfig: AdvancedConfigPayload = {
      classes: config.classes,
      turnos: config.turnos,
      matrix: config.matrix,
      subjects: config.subjects,
    };

    // ensure TypeScript knows these keys are present after the validation above
    const presetKeyToUse = (config.isCustom ? config.associatedPreset : config.presetKey) as CurriculumKey;

    const payload: CurriculumApplyPayload = {
      presetKey: presetKeyToUse,
      ano_letivo_id: sessionId,
      advancedConfig,
      customData: config.isCustom
        ? {
            label: config.label,
            associatedPreset: config.associatedPreset as CurriculumKey,
            classes: config.classes,
            subjects: config.subjects,
          }
        : undefined,
    };

    try {
      setIsSaving(true);

      const res = await fetch(
        `/api/escola/${escolaId}/admin/curriculo/apply-preset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao aplicar currículo");
      }

      // Se for custom, persistimos este "preset" para próximos usos
      if (config.isCustom) {
        const newCustom: CustomCourse = {
          key: `custom_${Date.now()}`,
          label: config.label,
          associatedPreset: config.associatedPreset as CurriculumKey,
          classes: config.classes,
          subjects: config.subjects,
        };

        const updated = [...customCourses, newCustom];
        setCustomCourses(updated);
        localStorage.setItem(
          `moxi_custom_courses_${escolaId}`,
          JSON.stringify(updated)
        );
      }

      toast.success(json.message || "Currículo aplicado com sucesso!");
      onComplete?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar configuração");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCustomFromModal = (data: {
    label: string;
    associatedPreset: CurriculumKey;
    classes: string[];
    subjects: string[];
  }) => {
    const newCustom: CustomCourse = {
      key: `custom_${Date.now()}`,
      ...data,
    };

    const updated = [...customCourses, newCustom];
    setCustomCourses(updated);
    localStorage.setItem(
      `moxi_custom_courses_${escolaId}`,
      JSON.stringify(updated)
    );

    setShowModal(false);
    setCategory("custom");
    handleSelectPreset(newCustom, true);
  };

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------

  const currentTipo = config.tipo || "geral";
  const tipoColors = TYPE_COLORS[currentTipo];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SIDEBAR */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                <Layers size={20} />
              </div>
              <span className="font-bold text-lg leading-tight">
                Criador
                <br />
                Curricular
              </span>
            </div>

            {/* Steps Indicator */}
            <div className="space-y-0 relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100 -z-10" />
              {["Tipo", "Classes", "Turnos", "Matriz"].map((label, idx) => {
                const s = idx + 1;
                const active = step === s;
                const done = step > s;
                return (
                  <div key={s} className="flex items-center gap-4 py-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${
                        active
                          ? "bg-slate-900 text-white ring-4 ring-slate-100"
                          : done
                          ? "bg-teal-500 text-white"
                          : "bg-slate-100 text-slate-400"
                      }
                    `}
                    >
                      {done ? <Check size={14} /> : s}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        active ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Resumo Dinâmico */}
            {config.presetKey && (
              <div className="mt-8 pt-6 border-t border-slate-100 text-xs space-y-3 animate-in fade-in">
                <p className="font-bold text-slate-400 uppercase tracking-wider">
                  Resumo
                </p>

                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded-lg ${
                      tipoColors?.bgLight || "bg-blue-50"
                    } border ${
                      tipoColors?.border || "border-blue-200"
                    } flex items-center justify-center`}
                  >
                    {(() => {
                      const Icon = getCourseIcon(
                        config.label || "",
                        currentTipo
                      );
                      return (
                        <Icon
                          size={12}
                          className={tipoColors?.text || "text-blue-600"}
                        />
                      );
                    })()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 truncate">
                      {config.label || "Sem nome"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {getTypeLabel(currentTipo)}
                      {config.isCustom && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <span>Classes:</span>{" "}
                  <strong>{config.classes.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Disciplinas:</span>{" "}
                  <strong>{config.subjects.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Turnos:</span>{" "}
                  <strong>
                    {["manha", "tarde", "noite"].filter(
                      (t) =>
                        (config.turnos as any)[t as BuilderTurnoKey] === true
                    ).length}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-8 border-b border-slate-100">
              <h1 className="text-2xl font-bold text-slate-800">
                {step === 1 && "Selecione o Modelo Base"}
                {step === 2 && "Configurar Classes"}
                {step === 3 && "Configurar Turnos"}
                {step === 4 && "Matriz Curricular"}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {step === 1 &&
                  "Escolha um nível ou curso técnico para começar. Cursos personalizados herdam ícone e cor do tipo associado."}
                {step === 2 && "Selecione as classes (anos) que este curso terá."}
                {step === 3 &&
                  "Defina os turnos em que o curso será oferecido."}
                {step === 4 &&
                  "Distribua as disciplinas por classe/turno. Este mapa é salvo em configuracoes_curriculo."}
              </p>
            </div>

            {/* Step Content */}
            <div className="flex-1 p-8">
              {/* STEP 1: seleção de modelo */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Pergunta sobre o tipo do curso */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          De qual tipo será o curso?
                        </h3>
                        <p className="text-xs text-slate-500">
                          Escolha se é um curso PUNIV ou Técnico para alinhar com os modelos do currículo oficial.
                        </p>
                      </div>
                      {trackFilter && trackFilter !== "all" && (
                        <button
                          onClick={() => handleTrackSelect("all")}
                          className="text-xs font-bold text-teal-600 hover:text-teal-700"
                        >
                          Ver todos
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {TRACK_OPTIONS.map((opt) => {
                        const colors = TYPE_COLORS[opt.id];
                        const Icon = TYPE_ICONS[opt.id];
                        const active = trackFilter === opt.id;

                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleTrackSelect(opt.id)}
                            className={`p-4 rounded-xl border-2 text-left flex gap-3 items-start transition-all ${
                              active
                                ? "border-teal-500 bg-teal-50 shadow-sm"
                                : "border-slate-200 hover:border-teal-200"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bgLight} border ${colors.border}`}
                            >
                              <Icon className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-800">
                                {opt.label}
                              </div>
                              <p className="text-xs text-slate-500">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}

                      <button
                        onClick={() => handleTrackSelect("all")}
                        className={`p-4 rounded-xl border-2 text-left flex gap-3 items-start transition-all ${
                          trackFilter === "all"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 border border-slate-200">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            Outro / ver todos os modelos
                          </div>
                          <p className="text-xs text-slate-500">
                            Inclui Primário, 1º Ciclo e demais presets.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Categorias */}
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const presetsInCat = getPresetsByCategory(cat.id);
                      if (cat.id === "custom" && presetsInCat.length === 0)
                        return null;
                      if (presetsInCat.length === 0) return null;

                      const isActive = category === cat.id;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                            isActive
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <cat.icon size={14} /> {cat.label}
                          <span className="text-[10px]">
                            ({presetsInCat.length})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botão para criar curso custom */}
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-400 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <PlusCircle className="w-8 h-8 text-slate-400 group-hover:text-teal-500 transition-colors" />
                    <span className="text-sm font-bold text-slate-600 group-hover:text-teal-700">
                      Criar Curso Personalizado
                    </span>
                    <span className="text-xs text-slate-400">
                      Ideal para cursos como Ciências Aeronáuticas, Agropecuária,
                      etc.
                    </span>
                  </button>

                  {/* Cards de presets */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPresetsByCategory(category).map((p: any) => {
                      const { icon: Icon, colors } = getPresetStyle(p);
                      const isSelected = config.presetKey === p.key;

                      return (
                        <div
                          key={p.key}
                          onClick={() => handleSelectPreset(p, p.isCustom)}
                          className={`p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md flex items-center gap-4 relative
                            ${
                              isSelected
                                ? "border-teal-500 bg-teal-50"
                                : "border-slate-100 hover:border-teal-200"
                            }
                          `}
                        >
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${colors.bgLight} border ${colors.border} ${
                              isSelected ? "ring-2 ring-teal-200" : ""
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-800 truncate">
                                {p.label || p.nome}
                              </h3>
                              {p.isCustom && (
                                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded">
                                  CUSTOM
                                </span>
                              )}
                              {!p.isCustom && p.recommended && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                  RECOMENDADO
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {p.classes?.length || 0} classes •{" "}
                              {p.subjects?.length || p.subjectsCount || 0}{" "}
                              disciplinas
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {p.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="ml-auto">
                              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                                <Check size={14} className="text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Classes */}
              {step === 2 && (
                <div className="animate-in fade-in">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                      Selecione as classes para {config.label || "o curso"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Estas classes serão usadas para criar disciplinas e,
                      depois, turmas.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 mb-6">
                    {ALL_CLASSES.map((cls) => (
                      <button
                        key={cls}
                        onClick={() => toggleClass(cls)}
                        className={`w-16 h-12 rounded-xl text-sm font-bold transition-all border-2
                          ${
                            config.classes.includes(cls)
                              ? "bg-slate-800 text-white border-slate-800 shadow-lg"
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          }
                        `}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                  {config.classes.length > 0 && (
                    <div className="p-4 bg-blue-50 text-blue-700 text-sm rounded-xl border border-blue-100">
                      <span className="font-bold">✓ Selecionadas: </span>
                      {config.classes.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Turnos */}
              {step === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                  {[
                    {
                      key: "manha" as BuilderTurnoKey,
                      label: "Manhã",
                      icon: Sun,
                      time: "07:00 - 12:30",
                    },
                    {
                      key: "tarde" as BuilderTurnoKey,
                      label: "Tarde",
                      icon: CloudSun,
                      time: "13:00 - 17:30",
                    },
                    {
                      key: "noite" as BuilderTurnoKey,
                      label: "Noite",
                      icon: Moon,
                      time: "18:00 - 22:00",
                    },
                  ].map((t) => {
                    const active = config.turnos[t.key];
                    return (
                      <button
                        key={t.key}
                        onClick={() => toggleTurno(t.key)}
                        className={`relative p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all
                          ${
                            active
                              ? "border-teal-500 bg-teal-50 text-teal-800"
                              : "border-slate-100 hover:border-slate-300 text-slate-400"
                          }
                        `}
                      >
                        <t.icon size={32} />
                        <div>
                          <div className="font-bold text-lg">{t.label}</div>
                          <div className="text-xs opacity-70">{t.time}</div>
                        </div>
                        {active && (
                          <div className="absolute top-3 right-3">
                            <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                              <Check size={14} className="text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* STEP 4: Matriz curricular */}
              {step === 4 && (
                <div className="animate-in fade-in space-y-6">
                  {/* Adicionar disciplina */}
                  <div className="flex gap-2">
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Adicionar disciplina extra..."
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-teal-500"
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                    />
                    <button
                      onClick={handleAddSubject}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold"
                    >
                      + Adicionar
                    </button>
                  </div>

                  {/* Tabela */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                    <div ref={subjectsScrollRef} className="max-h-[400px] overflow-y-auto">
                    <table className="w-full table-fixed text-sm text-left">
                      <thead className="bg-slate-900 text-white text-xs uppercase sticky top-0 z-20" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                        <tr>
                          <th className="px-4 py-3 sticky left-0 bg-slate-900 z-30">
                            Disciplina
                          </th>
                          {config.classes.map((cls) => (
                            <th
                              key={cls}
                              className="px-4 py-3 text-center border-l border-slate-700"
                              colSpan={
                                Object.values(config.turnos).filter(Boolean)
                                  .length || 1
                              }
                            >
                              {cls}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-slate-800 text-slate-300 text-[10px]">
                          <th className="px-4 py-2 sticky left-0 bg-slate-800" />
                          {config.classes.map((cls) =>
                            Object.entries(config.turnos).map(
                              ([key, active]) =>
                                active && (
                                  <th
                                    key={`${cls}-${key}`}
                                    className="px-2 py-1 text-center border-l border-slate-700 w-12"
                                  >
                                    {key[0].toUpperCase()}
                                  </th>
                                )
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y divide-slate-100"
                        style={
                          hasSubjects
                            ? {
                                position: "relative",
                                display: "block",
                                height: subjectsVirtualizer.getTotalSize(),
                              }
                            : undefined
                        }
                      >
                        {config.subjects.length === 0 ? (
                          <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                            <td
                              colSpan={10}
                              className="p-8 text-center text-slate-400"
                            >
                              Nenhuma disciplina configurada. Adicione acima ou
                              continue apenas com o preset padrão.
                            </td>
                          </tr>
                        ) : (
                          subjectsVirtualizer.getVirtualItems().map((virtualRow) => {
                            const sub = config.subjects[virtualRow.index];
                            return (
                              <tr
                                key={sub}
                                className="hover:bg-slate-50"
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
                                <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white border-r border-slate-100">
                                  {sub}
                                </td>
                                {config.classes.map((cls) =>
                                  Object.entries(config.turnos).map(
                                    ([turnoKey, active]) => {
                                      if (!active) return null;
                                      const short = turnoKey[0].toUpperCase();
                                      const k: MatrixKey = `${sub}::${cls}::${short}`;
                                      const checked = !!config.matrix[k];
                                      return (
                                        <td
                                          key={k}
                                          className="px-2 py-2 text-center border-l border-slate-100"
                                        >
                                          <div
                                            onClick={() =>
                                              toggleMatrixCell(
                                                sub,
                                                cls,
                                                short
                                              )
                                            }
                                            className={`w-5 h-5 mx-auto rounded border cursor-pointer flex items-center justify-center transition-colors ${
                                              checked
                                                ? "bg-teal-500 border-teal-500 text-white"
                                                : "bg-white border-slate-300 hover:border-teal-400"
                                            }`}
                                          >
                                            {checked && (
                                              <Check
                                                size={12}
                                                strokeWidth={4}
                                              />
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }
                                  )
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between">
              <button
                onClick={onCancel ?? handleBack}
                disabled={step === 1 && !onCancel}
                className="text-slate-500 font-bold text-sm px-4 py-2 hover:bg-white rounded-lg transition disabled:opacity-30"
              >
                <ChevronLeft size={16} className="inline mr-1" />{" "}
                {step === 1 && onCancel ? "Cancelar" : "Voltar"}
              </button>
              {step < 4 ? (
                <button
                  onClick={handleNext}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                >
                  Próximo <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Configuração
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Criar Curso Custom */}
      {showModal && (
        <CustomCourseModal
          onClose={() => setShowModal(false)}
          onSave={handleSaveCustomFromModal}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------
// MODAL: Curso Personalizado
// ------------------------------------------------------

function CustomCourseModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    label: string;
    associatedPreset: CurriculumKey;
    classes: string[];
    subjects: string[];
  }) => void;
}) {
  const [data, setData] = useState<{
    label: string;
    associatedPreset: CurriculumKey | "";
    classes: string[];
    subjects: string[];
  }>({
    label: "",
    associatedPreset: "",
    classes: [],
    subjects: [],
  });

  const [newSub, setNewSub] = useState("");

  const handleAddSub = () => {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    if (data.subjects.includes(trimmed)) {
      setNewSub("");
      return;
    }
    setData((prev) => ({
      ...prev,
      subjects: [...prev.subjects, trimmed],
    }));
    setNewSub("");
  };

  const presetOptions = Object.entries(CURRICULUM_PRESETS_META).map(
    ([key, meta]) => ({
      key: key as CurriculumKey,
      label: meta.label,
      tipo: getSafeTypeFromPreset(key),
    })
  );

  const selectedTipo: CourseType | null = data.associatedPreset
    ? getSafeTypeFromPreset(data.associatedPreset)
    : null;

  const selectedColors =
    (selectedTipo && TYPE_COLORS[selectedTipo]) || TYPE_COLORS.geral;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              Criar Curso Personalizado
            </h3>
            <p className="text-sm text-slate-500">
              O curso herdará ícone e cor do tipo associado (preset oficial).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nome do curso */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Nome do Curso Personalizado *
            </label>
            <input
              value={data.label}
              onChange={(e) =>
                setData((prev) => ({ ...prev, label: e.target.value }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              placeholder="Ex: Ciências Aeronáuticas, Agropecuária, Mecatrónica..."
              required
            />
          </div>

          {/* Tipo oficial associado */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Associar a Tipo Oficial (Preset) *
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Isso define o tipo (puniv, tecnico, etc.), o ícone e a cor
              em todo o sistema.
            </p>
            <select
              value={data.associatedPreset}
              onChange={(e) => {
                const nextPreset = e.target.value as CurriculumKey;
                setData((prev) => {
                  if (!nextPreset) {
                    return { ...prev, associatedPreset: "" };
                  }

                  const defaultClasses =
                    (CURRICULUM_PRESETS_META[nextPreset]?.classes || []).map(
                      normalizeClassLabel
                    );
                  const defaultSubjects = getSubjectsFromPreset(nextPreset);

                  return {
                    ...prev,
                    associatedPreset: nextPreset,
                    classes: prev.classes.length ? prev.classes : defaultClasses,
                    subjects: prev.subjects.length
                      ? prev.subjects
                      : defaultSubjects,
                  };
                });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              required
            >
              <option value="">Selecione um tipo...</option>
              {presetOptions.map((preset) => {
                const colors = TYPE_COLORS[preset.tipo];
                const Icon = TYPE_ICONS[preset.tipo];
                return (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                );
              })}
            </select>

            {data.associatedPreset && (
              <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded ${selectedColors.bgLight} border ${selectedColors.border} flex items-center justify-center`}
                >
                  <CourseTypeIcon
                    type={selectedTipo}
                    className={`w-5 h-5 ${selectedColors.text}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Tipo: {getTypeLabel(selectedTipo!)}
                  </p>
                  <p className="text-xs text-slate-500">
                    O curso aparecerá com este ícone e cor nas listagens,
                    matrículas e turmas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Classes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Classes *
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CLASSES.map((cls) => {
                const active = data.classes.includes(cls);
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      const has = data.classes.includes(cls);
                      setData((prev) => ({
                        ...prev,
                        classes: has
                          ? prev.classes.filter((c) => c !== cls)
                          : [...prev.classes, cls],
                      }));
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                      active
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {cls}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disciplinas */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Disciplinas *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="Nome da disciplina"
                onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
              />
              <button
                onClick={handleAddSub}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-bold transition"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((s) => (
                <span
                  key={s}
                  className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm text-slate-600 flex items-center gap-1"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        subjects: prev.subjects.filter(
                          (sub) => sub !== s
                        ),
                      }))
                    }
                    className="w-4 h-4 rounded-full hover:bg-slate-200 flex items-center justify-center"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!data.label.trim()) {
                toast.error("Digite um nome para o curso");
                return;
              }
              if (!data.associatedPreset) {
                toast.error("Selecione um tipo oficial para associar");
                return;
              }
              if (data.classes.length === 0) {
                toast.error("Selecione pelo menos uma classe");
                return;
              }
              if (data.subjects.length === 0) {
                toast.error("Adicione pelo menos uma disciplina");
                return;
              }
              onSave({
                label: data.label.trim(),
                associatedPreset: data.associatedPreset,
                classes: data.classes,
                subjects: data.subjects,
              });
            }}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition"
          >
            Criar Curso Personalizado
          </button>
        </div>
      </div>
    </div>
  );
}
