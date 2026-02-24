"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Layers,
  ArrowUpCircle,
  ChevronDown,
  Plus,
  Trash2,
  Wand2,
  Sun,
  Sunset,
  Moon,
  ScrollText,
  GraduationCap,
  Briefcase
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  CURRICULUM_PRESETS,
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/onboarding";
import {
  PRESET_TO_TYPE,
  type CourseType,
  getTypeLabel,
} from "@/lib/courseTypes";

import {
  createMatrixFromBlueprint,
  calculateTotalTurmas,
  type AcademicStep2Props,
  type MatrixRow,
  type CurriculumCategory,
  type TurnosState,
} from "./academicSetupTypes";
import {
  SchoolCurriculumManager,
  type BaseCurriculumSubject,
} from "./SchoolCurriculumManager";
import { useToast } from "@/components/feedback/FeedbackSystem";

// --- CONFIGURAÇÃO ---
const PRESET_CATEGORY_MAP: Record<CurriculumKey, CurriculumCategory> = {
  primario_generico: "geral",
  esg_ciclo1: "geral",
  esg_puniv_cfb: "geral",
  esg_puniv_cej: "geral",
  esg_puniv_cch: "geral",
  esg_puniv_artes: "geral",
  tec_contabilidade: "tecnico_serv",
  tec_informatica_gestao: "tecnico_serv",
  tec_recursos_humanos: "tecnico_serv",
  tec_secretariado: "tecnico_serv",
  tec_financas: "tecnico_serv",
  tec_comercio: "tecnico_serv",
  tec_saude_analises: "tecnico_serv",
  tec_saude_enfermagem: "tecnico_serv",
  tec_saude_estomatologia: "tecnico_serv",
  tec_saude_farmacia: "tecnico_serv",
  tec_saude_fisioterapia: "tecnico_serv",
  tec_saude_nutricao: "tecnico_serv",
  tec_saude_radiologia: "tecnico_serv",
  tec_construcao_civil: "tecnico_ind",
  tec_energia_eletrica: "tecnico_ind",
  tec_mecanica_manut: "tecnico_ind",
  tec_informatica_sistemas: "tecnico_ind",
  tec_desenhador_projectista: "tecnico_ind",
  tec_electronica_telecom: "tecnico_ind",
  tec_electronica_automacao: "tecnico_ind",
  tec_energias_renovaveis: "tecnico_ind",
  tec_geologia_petroleo: "tecnico_ind",
  tec_perfuracao_producao: "tecnico_ind",
  tec_minas: "tecnico_ind",
  tec_producao_metalomecanica: "tecnico_ind",
  tec_informatica: "tecnico_ind",
  tec_gestao_sistemas: "tecnico_serv",
};

interface PresetOption {
  key: CurriculumKey;
  label: string;
  badge?: string;
  description?: string;
  tipo: CourseType;
}

interface AddedCourse {
  id: CurriculumKey;
  label: string;
  tipo: CourseType;
}

// --- SUB-COMPONENTE: TABELA VIRTUALIZADA (UI REFINADA) ---
function CourseMatrixTable({
  rows,
  turnos,
  onMatrixUpdate,
}: {
  rows: MatrixRow[];
  turnos: TurnosState;
  onMatrixUpdate: (rowId: string, field: "manha" | "tarde" | "noite", value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasRows = rows.length > 0;
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64, // Altura estimada da linha (aumentada para conforto)
    overscan: 5,
  });

  // Styles helpers
  const inputClass = "w-14 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none transition-all focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20 placeholder:text-slate-200";
  const headerClass = "px-6 py-3 font-semibold text-center w-36 uppercase text-[10px] tracking-wider border-l border-slate-100";

  return (
    <div className="overflow-hidden rounded-b-xl border-t border-slate-100 bg-white">
      <div ref={scrollRef} className="max-h-[450px] overflow-y-auto custom-scrollbar">
        <table className="w-full table-fixed text-sm text-left">
          <thead
            className="bg-slate-50 sticky top-0 z-20 shadow-sm"
            style={{ display: "table", width: "100%", tableLayout: "fixed" }}
          >
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Classe / Curso</th>
              {turnos["Manhã"] && <th className={`${headerClass} bg-orange-50/40 text-orange-700`}>Manhã</th>}
              {turnos["Tarde"] && <th className={`${headerClass} bg-amber-50/40 text-amber-700`}>Tarde</th>}
              {turnos["Noite"] && <th className={`${headerClass} bg-indigo-50/40 text-indigo-700`}>Noite</th>}
            </tr>
          </thead>
          
          <tbody
            className="divide-y divide-slate-100"
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
            {!hasRows ? (
              <tr style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                <td colSpan={4} className="px-6 py-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-slate-50 rounded-full text-slate-300">
                    <ArrowUpCircle className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Nenhuma classe configurada</span>
                  <span className="text-xs text-slate-400">Adicione um curso acima para começar.</span>
                </td>
              </tr>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                      display: "table",
                      tableLayout: "fixed",
                      height: `${virtualRow.size}px` // Força altura correta
                    }}
                  >
                    <td className="px-6 py-3 align-middle">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm">{row.nome}</span>
                        <span className="text-[10px] text-slate-400">{row.cursoNome}</span>
                      </div>
                    </td>

                    {turnos["Manhã"] && (
                      <td className="px-6 py-2 text-center align-middle border-l border-slate-50 bg-orange-50/5">
                        <input
                          type="number" min={0} placeholder="0"
                          className={inputClass}
                          value={row.manha ?? ""}
                          onChange={(e) => onMatrixUpdate(row.id, "manha", e.target.value)}
                        />
                      </td>
                    )}

                    {turnos["Tarde"] && (
                      <td className="px-6 py-2 text-center align-middle border-l border-slate-50 bg-amber-50/5">
                        <input
                          type="number" min={0} placeholder="0"
                          className={inputClass}
                          value={row.tarde ?? ""}
                          onChange={(e) => onMatrixUpdate(row.id, "tarde", e.target.value)}
                        />
                      </td>
                    )}

                    {turnos["Noite"] && (
                      <td className="px-6 py-2 text-center align-middle border-l border-slate-50 bg-indigo-50/5">
                        <input
                          type="number" min={0} placeholder="0"
                          className={inputClass}
                          value={row.noite ?? ""}
                          onChange={(e) => onMatrixUpdate(row.id, "noite", e.target.value)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function AcademicStep2({
  escolaId,
  presetCategory,
  onPresetCategoryChange,
  matrix,
  onMatrixChange,
  onMatrixUpdate,
  turnos,
  onApplyCurriculumPreset,
  applyingPreset,
  padraoNomenclatura,
  onPadraoNomenclaturaChange,
  anoLetivo,
  curriculumOverrides,
  onCurriculumOverridesChange,
}: AcademicStep2Props) {
  const { toast, dismiss, success, error } = useToast();
  const [selectedPresetKey, setSelectedPresetKey] = useState<CurriculumKey | "">("");
  const [addedCourses, setAddedCourses] = useState<AddedCourse[]>([]);
  const [selectedCurriculumCourse, setSelectedCurriculumCourse] = useState<CurriculumKey | "">("");
  const [selectedCurriculumClass, setSelectedCurriculumClass] = useState<string>("");
  const [managerSeed, setManagerSeed] = useState(0);

  useEffect(() => {
    const uniqueKeys = Array.from(
      new Set(matrix.map((row) => row.cursoKey).filter(Boolean))
    ) as CurriculumKey[];

    setAddedCourses((prev) => {
      const prevMap = new Map(prev.map((course) => [course.id, course]));
      return uniqueKeys.map((key) =>
        prevMap.get(key) ?? {
          id: key,
          label: CURRICULUM_PRESETS_META[key]?.label ?? key,
          tipo: PRESET_TO_TYPE[key] ?? "geral",
        }
      );
    });
  }, [matrix]);

  // Filtros
  const filteredPresets: PresetOption[] = useMemo(() => {
    return (Object.entries(CURRICULUM_PRESETS_META) as [CurriculumKey, typeof CURRICULUM_PRESETS_META[CurriculumKey]][])
      .filter(([key]) => PRESET_CATEGORY_MAP[key] === presetCategory)
      .map(([key, meta]) => ({
        key,
        label: meta.label,
        badge: meta.badge,
        description: meta.description,
        tipo: PRESET_TO_TYPE[key] ?? "geral",
      }));
  }, [presetCategory]);

  const totalTurmas = useMemo(() => calculateTotalTurmas(matrix, turnos), [matrix, turnos]);

  // Visual
  const getCourseVisual = (tipo: CourseType) => {
    switch (tipo) {
      case "tecnico": return { Icon: Briefcase, bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" };
      case "tecnico_saude": return { Icon: GraduationCap, bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" };
      default: return { Icon: BookOpen, bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
    }
  };

  // Actions
  const handleAddCourse = () => {
    if (!selectedPresetKey) return;
    if (addedCourses.find((c) => c.id === selectedPresetKey)) {
      // Idealmente usar toast aqui, mas alert serve por hora se não tiver contexto
      alert("Curso já adicionado."); 
      return;
    }

    const blueprint = CURRICULUM_PRESETS[selectedPresetKey];
    const meta = CURRICULUM_PRESETS_META[selectedPresetKey];
    if (!blueprint || !meta) return;

    const tipo = PRESET_TO_TYPE[selectedPresetKey] ?? "geral";
    const newRows: MatrixRow[] = createMatrixFromBlueprint(blueprint).map((row, index) => ({
      ...row,
      id: `${selectedPresetKey}-${index}-${Date.now()}`,
      nome: row.nome,
      cursoKey: selectedPresetKey,
      cursoTipo: tipo,
      cursoNome: meta.label,
    }));

    onMatrixChange([...matrix, ...newRows]);
    setAddedCourses((prev) => [...prev, { id: selectedPresetKey, label: meta.label, tipo }]);
    setSelectedPresetKey("");
  };

  const handleRemoveCourse = (courseKey: CurriculumKey) => {
    onMatrixChange(matrix.filter((row) => row.cursoKey !== courseKey));
    setAddedCourses((prev) => prev.filter((c) => c.id !== courseKey));
    onCurriculumOverridesChange((prev) => {
      const prefix = `${courseKey}::`;
      return Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith(prefix))
      );
    });
  };

  const handleBulkApply = (field: "manha" | "tarde" | "noite", value: number) => {
    onMatrixChange(matrix.map((row) => ({ ...row, [field]: value })));
  };

  // Sample Name Logic
  const sampleNomeTurma = useMemo(() => {
    if (!matrix[0]) return "Ex: Informática 10ª Turma A";
    const primeiraClasse = matrix[0];
    const cursoNome = primeiraClasse?.cursoNome || "Curso";
    const classeNome = primeiraClasse?.nome || "10ª Classe";
    const turnoAtivo = turnos["Manhã"] ? "manha" : turnos["Tarde"] ? "tarde" : "noite";
    
    // Simplificado para exemplo visual
    const meta = CURRICULUM_PRESETS_META[primeiraClasse.cursoKey];
    const sigla = meta?.course_code || cursoNome.substring(0,3).toUpperCase();
    const ano = anoLetivo ? `(${anoLetivo})` : "";
    const turnoCode = turnoAtivo.toUpperCase().charAt(0);
    const turnoLabel = turnoCode === "M" ? "Manhã" : turnoCode === "T" ? "Tarde" : "Noite";
    const classeLimpa = `${classeNome.replace(/\D/g, "")}ª`;
    const letra = "A";

    switch (padraoNomenclatura) {
      case "descritivo_completo": return `${cursoNome} ${classeLimpa} Turma ${letra} ${ano}`.trim();
      case "descritivo_simples": return `${sigla} - ${classeLimpa} Turma ${letra} - ${turnoLabel}`;
      case "abreviado": return `${sigla}-${classeLimpa.replace("ª", "")}-${turnoCode}-${letra}`;
      default: return `${cursoNome} ${classeLimpa}`;
    }
  }, [matrix, turnos, padraoNomenclatura, anoLetivo]);

  const availableCurriculumCourses = useMemo(() => {
    return addedCourses.map((course) => course.id);
  }, [addedCourses]);

  const curriculumBlueprint = useMemo(() => {
    if (!selectedCurriculumCourse) return [];
    return CURRICULUM_PRESETS[selectedCurriculumCourse] ?? [];
  }, [selectedCurriculumCourse]);

  const availableCurriculumClasses = useMemo(() => {
    const classes = Array.from(new Set(curriculumBlueprint.map((d) => d.classe))).filter(Boolean);
    return classes;
  }, [curriculumBlueprint]);

  useEffect(() => {
    if (!selectedCurriculumCourse && availableCurriculumCourses.length > 0) {
      setSelectedCurriculumCourse(availableCurriculumCourses[0]);
      return;
    }
    if (
      selectedCurriculumCourse &&
      !availableCurriculumCourses.includes(selectedCurriculumCourse)
    ) {
      setSelectedCurriculumCourse(availableCurriculumCourses[0] ?? "");
    }
  }, [availableCurriculumCourses, selectedCurriculumCourse]);

  useEffect(() => {
    if (!selectedCurriculumCourse) {
      setSelectedCurriculumClass("");
      return;
    }
    if (!availableCurriculumClasses.includes(selectedCurriculumClass)) {
      setSelectedCurriculumClass(availableCurriculumClasses[0] ?? "");
    }
  }, [availableCurriculumClasses, selectedCurriculumClass, selectedCurriculumCourse]);

  const baseCurriculum = useMemo<BaseCurriculumSubject[]>(() => {
    if (!selectedCurriculumCourse || !selectedCurriculumClass) return [];
    return curriculumBlueprint
      .filter((disciplina) => disciplina.classe === selectedCurriculumClass)
      .map((disciplina) => ({
        id: disciplina.nome,
        name: disciplina.nome,
        baseHours: Number.isFinite(disciplina.horas) ? Number(disciplina.horas) : 0,
        component: disciplina.componente ?? "GERAL",
      }));
  }, [curriculumBlueprint, selectedCurriculumClass, selectedCurriculumCourse]);

  const initialOverrides = useMemo(() => {
    if (!selectedCurriculumCourse || !selectedCurriculumClass) return {};
    const prefix = `${selectedCurriculumCourse}::${selectedCurriculumClass}::`;
    return Object.fromEntries(
      Object.entries(curriculumOverrides)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value])
    );
  }, [curriculumOverrides, selectedCurriculumCourse, selectedCurriculumClass]);

  const selectedCourseLabel = useMemo(() => {
    if (!selectedCurriculumCourse) return "";
    return CURRICULUM_PRESETS_META[selectedCurriculumCourse]?.label ?? "";
  }, [selectedCurriculumCourse]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. SELEÇÃO DE CURSOS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Oferta Formativa</h3>
            <p className="text-xs text-slate-500">Selecione os cursos para compor a grade.</p>
          </div>
        </div>

        {/* Abas de Categoria */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: "geral" as CurriculumCategory, label: "Ensino Geral", icon: BookOpen },
            { id: "tecnico_ind" as CurriculumCategory, label: "Indústria & Tec", icon: ScrollText },
            { id: "tecnico_serv" as CurriculumCategory, label: "Serviços & Saúde", icon: GraduationCap },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onPresetCategoryChange(cat.id as any)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-bold transition-all ${
                presetCategory === cat.id
                  ? "border-slate-800 bg-slate-800 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Dropdown + Botão */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <select
              className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-700 outline-none transition-all hover:border-[#E3B23C] focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C]"
              value={selectedPresetKey}
              onChange={(e) => setSelectedPresetKey(e.target.value as CurriculumKey | "")}
            >
              <option value="">Selecione um curso para adicionar...</option>
              {filteredPresets.map((meta) => (
                <option key={meta.key} value={meta.key}>
                  {meta.label} {meta.badge ? `(${meta.badge})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={handleAddCourse}
            disabled={!selectedPresetKey}
            // TOKEN: Botão Dourado CTA
            className="flex items-center gap-2 rounded-xl bg-[#E3B23C] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale active:scale-95"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        {/* Chips dos cursos adicionados */}
        {addedCourses.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Cursos Selecionados</p>
            <div className="flex flex-wrap gap-2">
              {addedCourses.map((course) => {
                const { Icon, bg, text, border } = getCourseVisual(course.tipo);
                return (
                  <div key={course.id} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold animate-in fade-in zoom-in ${bg} ${border} ${text}`}>
                    <Icon className="h-3 w-3" />
                    <span>{course.label}</span>
                    <button onClick={() => handleRemoveCourse(course.id)} className="ml-1 rounded-full p-0.5 hover:bg-black/10 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. MATRIZ DE TURMAS */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        
        {/* Header da Matriz */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">Matriz de Turmas</span>
          </div>
          {/* TOKEN: Badge Verde Brand */}
          <span className="rounded-full border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 px-3 py-1 text-xs font-bold text-[#1F6B3B]">
            {totalTurmas} turmas a criar
          </span>
        </div>

        {/* Configurações de Nomenclatura */}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Padrão de Nomes</label>
            <div className="flex rounded-lg border border-slate-200 p-1">
              {[
                { id: 'descritivo_completo', label: 'Completo' },
                { id: 'descritivo_simples', label: 'Simples' },
                { id: 'abreviado', label: 'Curto' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onPadraoNomenclaturaChange(opt.id as any)}
                  className={`rounded px-3 py-1 text-[10px] font-bold transition-all ${
                    padraoNomenclatura === opt.id ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Preview: <strong className="text-slate-800">{sampleNomeTurma}</strong>
          </div>
        </div>

        {/* Bulk Actions (Magic Wand) */}
        {matrix.length > 0 && (
          <div className="flex items-center gap-4 overflow-x-auto border-b border-slate-100 bg-white px-6 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Wand2 className="h-3.5 w-3.5 text-[#E3B23C]" />
              <span>Preencher:</span>
            </div>
            
            <div className="flex gap-3">
              {turnos["Manhã"] && (
                <div className="flex items-center gap-1 rounded-md border border-orange-100 bg-orange-50 px-2 py-1">
                  <Sun size={10} className="text-orange-500 mr-1" />
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => handleBulkApply("manha", n)} className="flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] font-bold text-orange-700 shadow-sm border border-orange-200 hover:bg-orange-100">{n}</button>
                  ))}
                </div>
              )}
              {turnos["Tarde"] && (
                <div className="flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-2 py-1">
                  <Sunset size={10} className="text-amber-500 mr-1" />
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => handleBulkApply("tarde", n)} className="flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] font-bold text-amber-700 shadow-sm border border-amber-200 hover:bg-amber-100">{n}</button>
                  ))}
                </div>
              )}
              {turnos["Noite"] && (
                <div className="flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1">
                  <Moon size={10} className="text-indigo-500 mr-1" />
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => handleBulkApply("noite", n)} className="flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] font-bold text-indigo-700 shadow-sm border border-indigo-200 hover:bg-indigo-100">{n}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabela Virtualizada */}
        <CourseMatrixTable 
          rows={matrix} 
          turnos={turnos} 
          onMatrixUpdate={onMatrixUpdate} 
        />

        {addedCourses.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Ajuste de carga horária (visão macro)</h4>
                <p className="text-xs text-slate-500">
                  Ajuste os tempos por disciplina antes de gerar turmas e horários.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedCurriculumCourse}
                  onChange={(event) => setSelectedCurriculumCourse(event.target.value as CurriculumKey)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {availableCurriculumCourses.map((course) => (
                    <option key={course} value={course}>
                      {CURRICULUM_PRESETS_META[course]?.label ?? course}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedCurriculumClass}
                  onChange={(event) => setSelectedCurriculumClass(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  {availableCurriculumClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCurriculumCourse && selectedCurriculumClass && (
              <SchoolCurriculumManager
                key={`${selectedCurriculumCourse}-${selectedCurriculumClass}-${managerSeed}`}
                courseName={selectedCourseLabel}
                gradeLevel={selectedCurriculumClass}
                baseCurriculum={baseCurriculum}
                initialOverrides={initialOverrides}
                onSave={async (payload) => {
                  const prefix = `${selectedCurriculumCourse}::${selectedCurriculumClass}::`;
                  const tid = toast({ variant: "syncing", title: "Salvando matriz...", duration: 0 });
                  const nextOverrides = Object.fromEntries(
                    Object.entries(curriculumOverrides).filter(([key]) => !key.startsWith(prefix))
                  ) as Record<string, number>;
                  Object.entries(payload).forEach(([subjectId, value]) => {
                    nextOverrides[`${prefix}${subjectId}`] = value;
                  });
                  try {
                    onCurriculumOverridesChange(nextOverrides);
                    const res = await fetch(`/api/escolas/${escolaId}/onboarding/draft`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ step: 3, data: { curriculumOverrides: nextOverrides } }),
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok || json?.ok === false) {
                      throw new Error(json?.error || "Erro ao salvar a matriz");
                    }
                    dismiss(tid);
                    success("Matriz salva.");
                  } catch (err) {
                    dismiss(tid);
                    error(err instanceof Error ? err.message : "Erro ao salvar.");
                  }
                }}
                onCancel={() => setManagerSeed((prev) => prev + 1)}
              />
            )}
          </div>
        )}

        {/* Botão Final (Apply) */}
        <div className="flex justify-end bg-slate-50 px-6 py-4 border-t border-slate-100">
          {totalTurmas === 0 && matrix.length > 0 && (
            <div className="mr-auto text-xs text-slate-500">
              Você pode concluir agora e ajustar cargas/períodos depois no currículo.
            </div>
          )}
          <button
            type="button"
            onClick={onApplyCurriculumPreset}
            disabled={applyingPreset || matrix.length === 0}
            // TOKEN: Botão Dourado Action (#E3B23C)
            className="flex items-center gap-2 rounded-xl bg-[#E3B23C] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-900/5 transition-all hover:brightness-95 hover:shadow-lg hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale"
          >
            {applyingPreset ? (
              <>Applying...</>
            ) : (
              <>Concluir Configuração</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
