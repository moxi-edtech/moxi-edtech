"use client";

import { useState, useEffect } from "react";
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
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { gerarNomeTurma } from "@/lib/turmaNaming";

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
type Nomenclatura = 'descritivo_completo' | 'descritivo_simples' | 'abreviado';

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
  presetKey: CurriculumKey | null;
  label: string;
  tipo: CourseType | null;
  classes: string[];
  subjects: string[];
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;
  isCustom: boolean;
  associatedPreset: CurriculumKey | null;
  turmasConfig: Record<string, Record<string, number>>;
  nomenclaturaPadrao: Nomenclatura;
}

// Payload que vamos mandar para a API
interface AdvancedConfigPayload {
  classes: string[];
  turnos: BuilderTurnos;
  matrix: Record<MatrixKey, boolean>;
  subjects: string[];
  turmasPorCombinacao?: Record<string, Record<string, number>>;
  padraoNomenclatura?: Nomenclatura;
}

interface CustomDataPayload {
  label: string;
  associatedPreset: CurriculumKey;
  classes: string[];
  subjects: string[];
}

interface CurriculumApplyPayload {
  presetKey: CurriculumKey;
  sessionId?: string | null;
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

// ------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------

export default function CurriculumBuilder({
  escolaId,
  sessionId,
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

  const [config, setConfig] = useState<BuilderConfig>({
    presetKey: null,
    label: "",
    tipo: null,
    classes: [],
    turnos: { manha: false, tarde: false, noite: false },
    subjects: [],
    matrix: {},
    isCustom: false,
    associatedPreset: null,
    turmasConfig: {},
    nomenclaturaPadrao: 'descritivo_completo',
  });
  
  const handleUpdateTurmasConfig = (classe: string, turno: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      turmasConfig: {
        ...prev.turmasConfig,
        [classe]: {
          ...prev.turmasConfig[classe],
          [turno]: value,
        }
      }
    }));
  };

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

  const getPresetsByCategory = (catId: CategoryId) => {
    const matchesTrack = (preset: any) => {
      if (!trackFilter || trackFilter === "all") return true;

      const baseKey: string =
        (preset.isCustom && preset.associatedPreset) || preset.id || preset.key;

      return getSafeTypeFromPreset(baseKey) === trackFilter;
    };

    if (catId === "custom") {
      return customCourses
        .map((c) => ({
          id: c.key,
          label: c.label,
          classes: c.classes,
          subjects: c.subjects,
          isCustom: true,
          associatedPreset: c.associatedPreset,
        }))
        .filter(matchesTrack);
    }

    const keysForCat: CurriculumKey[] =
      catId === "geral"
        ? [
            "primario_base",
            "primario_avancado",
            "ciclo1",
            "puniv",
            "economicas",
          ]
        : [
            "tecnico_informatica",
            "tecnico_gestao",
            "tecnico_construcao",
            "tecnico_base",
            "saude_enfermagem",
            "saude_farmacia_analises",
          ];

    return keysForCat
      .map((key) => {
        const meta = CURRICULUM_PRESETS_META[key];
        return {
          id: key,
          label: meta.label,
          classes: meta.classes,
          badge: meta.badge,
          description: meta.description,
          isCustom: false,
        };
      })
      .filter(matchesTrack);
  };

  const handleTrackSelect = (value: TrackFilter) => {
    setTrackFilter(value);

    if (value === "tecnico") setCategory("tecnico");
    else if (value === "puniv") setCategory("geral");
  };

  const getPresetStyle = (preset: any) => {
    const baseKey: string =
      (preset.isCustom && preset.associatedPreset) || preset.id || preset.key;

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

  const handleSelectPreset = (preset: any, isCustom: boolean) => {
    const presetKey = (preset.id || preset.key || null) as CurriculumKey | null;
    const baseKey: string =
      (isCustom && preset.associatedPreset) || preset.id || preset.key;

    const tipo = getSafeTypeFromPreset(baseKey);
    const meta =
      !isCustom && presetKey ? CURRICULUM_PRESETS_META[presetKey] : null;

    const label: string =
      preset.label ||
      preset.nome ||
      meta?.label ||
      preset.curso_nome ||
      "";

    const defaultClasses: string[] =
      (preset.classes || meta?.classes || []).map(normalizeClassLabel);

    const subjects: string[] =
      isCustom && preset.subjects
        ? preset.subjects
        : getSubjectsFromPreset(presetKey);

    setConfig(prev => ({
      ...prev,
      presetKey: presetKey || null,
      label,
      tipo,
      classes: defaultClasses,
      subjects,
      isCustom,
      associatedPreset: isCustom
        ? ((preset.associatedPreset as CurriculumKey | undefined) || null)
        : (presetKey as CurriculumKey | null),
    }));
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
      initMatrixIfNeeded();
    }

    setStep((s) => Math.min(5, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFinish = async () => {
    if (!config.presetKey || (config.isCustom && !config.associatedPreset)) {
      toast.error("Configuração de preset inválida.");
      return;
    }

    const advancedConfig: AdvancedConfigPayload = {
      classes: config.classes,
      turnos: config.turnos,
      matrix: config.matrix,
      subjects: config.subjects,
      turmasPorCombinacao: config.turmasConfig,
      padraoNomenclatura: config.nomenclaturaPadrao,
    };

    const payload: CurriculumApplyPayload = {
      presetKey: (config.isCustom ? config.associatedPreset : config.presetKey) as CurriculumKey,
      sessionId,
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
        `/api/escolas/${escolaId}/onboarding/curriculum/apply`,
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
              {["Tipo", "Classes", "Turnos", "Matriz", "Turmas"].map((label, idx) => {
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
                {step === 5 && "Configurar Turmas"}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {step === 1 && "Escolha um nível ou curso técnico para começar."}
                {step === 2 && "Selecione as classes (anos) que este curso terá."}
                {step === 3 && "Defina os turnos em que o curso será oferecido."}
                {step === 4 && "Distribua as disciplinas por classe/turno."}
                {step === 5 && "Defina quantas turmas criar por padrão e como nomeá-las."}
              </p>
            </div>

            {/* Step Content */}
            <div className="flex-1 p-8">
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in">
                  {/* ... (código do Step 1) ... */}
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in">
                  {/* ... (código do Step 2) ... */}
                </div>
              )}

              {step === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                   {/* ... (código do Step 3) ... */}
                </div>
              )}

              {step === 4 && (
                <div className="animate-in fade-in space-y-6">
                   {/* ... (código do Step 4) ... */}
                </div>
              )}
              
              {step === 5 && (
                <div className="animate-in fade-in space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">Padrão de Nomenclatura das Turmas</h3>
                        <p className="text-sm text-slate-500">Escolha como os nomes das turmas serão gerados automaticamente.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(['descritivo_completo', 'descritivo_simples', 'abreviado'] as Nomenclatura[]).map(padrao => (
                            <button
                                key={padrao}
                                onClick={() => setConfig(prev => ({...prev, nomenclaturaPadrao: padrao}))}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${config.nomenclaturaPadrao === padrao ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-200'}`}
                            >
                                <div className="font-bold text-sm text-slate-800">
                                    {padrao.replace('_', ' ')}
                                </div>
                                <p className="text-xs text-slate-600 mt-1">
                                    Ex: {gerarNomeTurma(config.label, config.classes[0] || '10ª Classe', 'manha', 1, padrao)}
                                </p>
                            </button>
                        ))}
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">Quantidade de Turmas por Combinação</h3>
                        <p className="text-sm text-slate-500">Defina quantas turmas criar para cada classe e turno. O padrão é 1.</p>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Classe</th>
                                    <th className="px-4 py-3">Turno</th>
                                    <th className="px-4 py-3">Quantidade de Turmas</th>
                                    <th className="px-4 py-3">Exemplo de Nome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {config.classes.map(classe =>
                                    Object.entries(config.turnos)
                                        .filter(([, active]) => active)
                                        .map(([turnoKey]) => (
                                            <tr key={`${classe}-${turnoKey}`} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-700">{classe}</td>
                                                <td className="px-4 py-3 capitalize">{turnoKey}</td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="10"
                                                        value={config.turmasConfig[classe]?.[turnoKey] || 1}
                                                        onChange={(e) => handleUpdateTurmasConfig(classe, turnoKey, parseInt(e.target.value))}
                                                        className="w-20 px-2 py-1 border border-slate-300 rounded-md text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                    {gerarNomeTurma(config.label, classe, turnoKey, 1, config.nomenclaturaPadrao)}
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
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
              {step < 5 ? (
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

      {showModal && (
        <CustomCourseModal
          onClose={() => setShowModal(false)}
          onSave={handleSaveCustomFromModal}
        />
      )}
    </div>
  );
}

// ... (Restante do código, incluindo CustomCourseModal, permanece o mesmo)
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

  useEffect(() => {
    if (!data.associatedPreset) return;

    const defaultClasses =
      (CURRICULUM_PRESETS_META[data.associatedPreset]?.classes || []).map(
        normalizeClassLabel
      );
    const defaultSubjects = getSubjectsFromPreset(data.associatedPreset);

    setData((prev) => ({
      ...prev,
      classes: prev.classes.length ? prev.classes : defaultClasses,
      subjects: prev.subjects.length ? prev.subjects : defaultSubjects,
    }));
  }, [data.associatedPreset]);

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
      id: key as CurriculumKey,
      label: meta.label,
      tipo: getSafeTypeFromPreset(key),
    })
  );

  const selectedTipo: CourseType | null = data.associatedPreset
    ? getSafeTypeFromPreset(data.associatedPreset)
    : null;

  const selectedColors =
    (selectedTipo && TYPE_COLORS[selectedTipo]) || TYPE_COLORS.geral;
  const SelectedIcon =
    (selectedTipo && TYPE_ICONS[selectedTipo]) || BookOpen;

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
              value={data.associatedPreset || ""}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  associatedPreset: (e.target.value as CurriculumKey) || null,
                }))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              required
            >
              <option value="">Selecione um tipo...</option>
              {presetOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>

            {data.associatedPreset && (
              <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded ${selectedColors.bgLight} border ${selectedColors.border} flex items-center justify-center`}
                >
                  <SelectedIcon
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
