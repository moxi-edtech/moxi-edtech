"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";

import {
  CURRICULUM_PRESETS,
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/onboarding";
import {
  PRESET_TO_TYPE,
  TYPE_ICONS,
  TYPE_COLORS,
  type CourseType,
  getTypeLabel,
} from "@/lib/courseTypes";

import {
  createMatrixFromBlueprint,
  calculateTotalTurmas,
  type AcademicStep2Props,
  type MatrixRow,
  type CurriculumCategory,
  type PadraoNomenclatura,
} from "./academicSetupTypes";

// Mapeamento de presets → categorias de UI do Step2
const PRESET_CATEGORY_MAP: Record<CurriculumKey, CurriculumCategory> = {
  primario_base: "geral",
  primario_avancado: "geral",
  ciclo1: "geral",
  puniv: "geral",
  economicas: "geral",
  tecnico_informatica: "tecnico_ind",
  tecnico_construcao: "tecnico_ind",
  tecnico_base: "tecnico_ind",
  tecnico_gestao: "tecnico_serv",
  saude_enfermagem: "tecnico_serv",          // saúde tratado como técnico/serviços
  saude_farmacia_analises: "tecnico_serv",
};

// Tipo local para opções de preset já enriquecidas
interface PresetOption {
  key: CurriculumKey;
  label: string;
  badge?: string;
  description?: string;
  tipo: CourseType;
}

// Curso adicionado à estrutura
interface AddedCourse {
  id: CurriculumKey;
  label: string;
  tipo: CourseType;
}

export default function AcademicStep2({
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
}: AcademicStep2Props) {
  const [selectedPresetKey, setSelectedPresetKey] = useState<CurriculumKey | "">("");
  const [addedCourses, setAddedCourses] = useState<AddedCourse[]>([]);

  // Presets filtrados por categoria de UI
  const filteredPresets: PresetOption[] = useMemo(() => {
    return (Object.entries(CURRICULUM_PRESETS_META) as [
      CurriculumKey,
      (typeof CURRICULUM_PRESETS_META)[CurriculumKey]
    ][])
      .filter(([key]) => PRESET_CATEGORY_MAP[key] === presetCategory)
      .map(([key, meta]) => {
        const tipo: CourseType = PRESET_TO_TYPE[key] ?? "geral";
        return {
          key,
          label: meta.label,
          badge: meta.badge,
          description: meta.description,
          tipo,
        } as PresetOption;
      });
  }, [presetCategory]);

  const totalTurmas = useMemo(
    () => calculateTotalTurmas(matrix, turnos),
    [matrix, turnos]
  );

  // Ícone + cores de um tipo de curso
  const getCourseVisual = (tipo: CourseType) => {
    const Icon = TYPE_ICONS[tipo] || BookOpen;
    const colors = TYPE_COLORS[tipo] || TYPE_COLORS.geral;
    return { Icon, colors };
  };

  // --- 1. ADICIONAR CURSO ---
  const handleAddCourse = () => {
    if (!selectedPresetKey) return;

    if (addedCourses.find((c) => c.id === selectedPresetKey)) {
      alert("Este curso já foi adicionado à estrutura.");
      return;
    }

    const blueprint = CURRICULUM_PRESETS[selectedPresetKey];
    const meta = CURRICULUM_PRESETS_META[selectedPresetKey];

    if (!blueprint || !meta) return;

    const tipo: CourseType = PRESET_TO_TYPE[selectedPresetKey] ?? "geral";

    const newRows: MatrixRow[] = createMatrixFromBlueprint(blueprint).map(
      (row, index) => ({
        ...row,
        id: `${selectedPresetKey}-${index}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 5)}`,
        nome: row.nome,
        cursoKey: selectedPresetKey,
        cursoTipo: tipo,
        cursoNome: meta.label,
      })
    );

    onMatrixChange([...matrix, ...newRows]);
    setAddedCourses((prev) => [
      ...prev,
      {
        id: selectedPresetKey,
        label: meta.label,
        tipo,
      },
    ]);
    setSelectedPresetKey("");
  };

  // --- 2. REMOVER CURSO ---
  const handleRemoveCourse = (courseKey: CurriculumKey) => {
    const newMatrix = matrix.filter((row) => row.cursoKey !== courseKey);
    onMatrixChange(newMatrix);
    setAddedCourses((prev) => prev.filter((c) => c.id !== courseKey));
  };

  // --- 3. BULK ACTION (VARINHA MÁGICA) ---
  const handleBulkApply = (field: "manha" | "tarde" | "noite", value: number) => {
    const newMatrix = matrix.map((row) => ({
      ...row,
      [field]: value,
    }));
    onMatrixChange(newMatrix);
  };

  // Agrupar matriz por curso para exibição
  const groupedByCourse = useMemo(() => {
    const groups: Record<string, MatrixRow[]> = {};

    matrix.forEach((row) => {
      if (!groups[row.cursoKey]) {
        groups[row.cursoKey] = [];
      }
      groups[row.cursoKey].push(row);
    });

    return groups;
  }, [matrix]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* CARD DE SELEÇÃO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg border border-teal-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Composição da Escola
            </h3>
            <p className="text-xs text-slate-500">
              Adicione todos os níveis e cursos que a escola oferece.
              <span className="block text-teal-600 text-[10px] font-bold mt-1">
                Cada curso herdará seu ícone e cor no sistema.
              </span>
            </p>
          </div>
        </div>

        {/* Filtros de categoria (sem aba "Saúde") */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: "geral" as CurriculumCategory, label: "Ensino Geral", icon: BookOpen },
            {
              id: "tecnico_ind" as CurriculumCategory,
              label: "Indústria & Tec",
              icon: ScrollText,
            },
            {
              id: "tecnico_serv" as CurriculumCategory,
              label: "Gestão & Serviços / Saúde",
              icon: GraduationCap,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onPresetCategoryChange(cat.id as any)}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border flex items-center gap-1 ${
                presetCategory === cat.id
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Select + Botão Adicionar */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <select
              className="block w-full pl-4 pr-10 py-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white font-medium text-slate-700 cursor-pointer transition-shadow hover:border-teal-400"
              value={selectedPresetKey}
              onChange={(e) =>
                setSelectedPresetKey(e.target.value as CurriculumKey | "")
              }
            >
              <option value="">Selecione para adicionar...</option>
              {filteredPresets.map((meta) => (
                <option key={meta.key} value={meta.key}>
                  {meta.label}
                  {meta.badge && ` (${meta.badge})`} · {getTypeLabel(meta.tipo)}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddCourse}
            disabled={!selectedPresetKey}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {/* Lista de Cursos Adicionados */}
        {addedCourses.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
              Estrutura Atual:
            </p>
            <div className="flex flex-wrap gap-2">
              {addedCourses.map((course) => {
                const { Icon, colors } = getCourseVisual(course.tipo);
                return (
                  <div
                    key={course.id}
                    className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-semibold animate-in fade-in zoom-in
                               ${colors.bgLight} ${colors.border} ${colors.text}`}
                  >
                    <div
                      className={`w-4 h-4 rounded ${colors.bgLight} flex items-center justify-center`}
                    >
                      <Icon className={`w-3 h-3 ${colors.text}`} />
                    </div>
                    <span>{course.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCourse(course.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. MATRIZ DE TURMAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-sm text-slate-700">
              Definição de Turmas
            </span>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
            {totalTurmas} turmas a criar
          </span>
        </div>

        {/* SELETOR DE NOMENCLATURA */}
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Padrão de Nomes</label>
            <div className="flex gap-2">
              {(
                [
                  { id: 'descritivo_completo', label: 'Completo' },
                  { id: 'descritivo_simples', label: 'Simples' },
                  { id: 'abreviado', label: 'Abreviado' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPadraoNomenclaturaChange(opt.id)}
                  className={`flex-1 py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all ${
                    padraoNomenclatura === opt.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-md"
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
        </div>

        {/* Barra mágica */}
        {matrix.length > 0 && (
          <div className="bg-white border-b border-slate-100 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap">
              <Wand2 className="w-4 h-4 text-purple-500" />
              <span>Preenchimento Rápido:</span>
            </div>

            <div className="flex gap-4">
              {turnos["Manhã"] && (
                <div className="flex items-center gap-2 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                  <Sun size={12} className="text-orange-500" />
                  <span className="text-[10px] font-bold text-orange-700">
                    Manhã:
                  </span>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleBulkApply("manha", n)}
                      className="w-5 h-5 flex items-center justify-center bg-white text-orange-700 border border-orange-200 rounded text-[10px] hover:bg-orange-100 transition"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {turnos["Tarde"] && (
                <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                  <Sunset size={12} className="text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-700">
                    Tarde:
                  </span>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleBulkApply("tarde", n)}
                      className="w-5 h-5 flex items-center justify-center bg-white text-amber-700 border border-amber-200 rounded text-[10px] hover:bg-amber-100 transition"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {turnos["Noite"] && (
                <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                  <Moon size={12} className="text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-700">
                    Noite:
                  </span>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleBulkApply("noite", n)}
                      className="w-5 h-5 flex items-center justify-center bg-white text-indigo-700 border border-indigo-200 rounded text-[10px] hover:bg-indigo-100 transition"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matriz agrupada por curso */}
        {Object.entries(groupedByCourse).map(([cursoKey, rows]) => {
          const key = cursoKey as CurriculumKey;
          const meta = CURRICULUM_PRESETS_META[key];
          const tipo: CourseType = PRESET_TO_TYPE[key] ?? "geral";
          const { Icon, colors } = getCourseVisual(tipo);

          return (
            <div key={cursoKey} className="border-b border-slate-100 last:border-b-0">
              {/* Cabeçalho por curso */}
              <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${colors.bgLight} border ${colors.border} flex items-center justify-center`}
                  >
                    <Icon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      {meta?.label ?? "Curso"}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bgLight} ${colors.text} border ${colors.border}`}
                      >
                        {tipo.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {rows.length} classe{rows.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabela do curso */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-white">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-slate-500">
                        Classe
                      </th>
                      {turnos["Manhã"] && (
                        <th className="px-6 py-3 font-semibold text-center w-32 bg-orange-50/50 text-orange-600 border-l border-slate-100">
                          Manhã
                        </th>
                      )}
                      {turnos["Tarde"] && (
                        <th className="px-6 py-3 font-semibold text-center w-32 bg-amber-50/50 text-amber-600 border-l border-slate-100">
                          Tarde
                        </th>
                      )}
                      {turnos["Noite"] && (
                        <th className="px-6 py-3 font-semibold text-center w-32 bg-indigo-50/50 text-indigo-600 border-l border-slate-100">
                          Noite
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50 transition group"
                      >
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {row.nome}
                        </td>

                        {turnos["Manhã"] && (
                          <td className="px-6 py-2 text-center bg-orange-50/10 border-l border-slate-100">
                            <input
                              type="number"
                              min={0}
                              className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                              value={row.manha ?? ""}
                              placeholder="0"
                              onChange={(e) =>
                                onMatrixUpdate(row.id, "manha", e.target.value)
                              }
                            />
                          </td>
                        )}

                        {turnos["Tarde"] && (
                          <td className="px-6 py-2 text-center bg-amber-50/10 border-l border-slate-100">
                            <input
                              type="number"
                              min={0}
                              className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                              value={row.tarde ?? ""}
                              placeholder="0"
                              onChange={(e) =>
                                onMatrixUpdate(row.id, "tarde", e.target.value)
                              }
                            />
                          </td>
                        )}

                        {turnos["Noite"] && (
                          <td className="px-6 py-2 text-center bg-indigo-50/10 border-l border-slate-100">
                            <input
                              type="number"
                              min={0}
                              className="w-12 h-9 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
                              value={row.noite ?? ""}
                              placeholder="0"
                              onChange={(e) =>
                                onMatrixUpdate(row.id, "noite", e.target.value)
                              }
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {matrix.length === 0 && (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-300">
              <ArrowUpCircle className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm font-medium">
              A matriz está vazia
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Selecione um curso acima e adicione-o.
            </p>
          </div>
        )}
      </div>

      {/* Botão aplicar modelo */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onApplyCurriculumPreset}
          disabled={applyingPreset || totalTurmas === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {applyingPreset ? "Aplicando..." : "Concluir Configuração"}
        </button>
      </div>
    </div>
  );
}
