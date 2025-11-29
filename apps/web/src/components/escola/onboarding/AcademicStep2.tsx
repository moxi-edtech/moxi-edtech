"use client";

import { useMemo } from "react";
import { BookOpen, Layers, ArrowUpCircle, ChevronDown } from "lucide-react";
import { CURRICULUM_PRESETS } from "@/lib/onboarding";

import {
  PRESETS_META,
  createMatrixFromBlueprint,
  getDisciplinasFromBlueprint,
  calculateTotalTurmas,
} from "./academicSetupTypes";

import type {
  AcademicStep2Props,
  MatrixRow,
  SelectedBlueprint,
  CurriculumKey,
  CurriculumCategory,
  CurriculumDisciplineBlueprint,
} from "./academicSetupTypes";

export default function AcademicStep2({
  presetCategory,
  onPresetCategoryChange,
  curriculumPreset,
  onCurriculumPresetChange,
  selectedBlueprint,
  onSelectedBlueprintChange,
  matrix,
  onMatrixChange,
  onMatrixUpdate,
  presetApplied,
  applyingPreset,
  turnos,
  onApplyCurriculumPreset,
}: AcademicStep2Props) {
  const filteredPresets = useMemo(
    () => PRESETS_META.filter((m) => m.categoria === presetCategory),
    [presetCategory]
  );

  const totalTurmas = useMemo(
    () => calculateTotalTurmas(matrix, turnos),
    [matrix, turnos]
  );

  const handlePresetChange = (key: string) => {
    onCurriculumPresetChange(key as CurriculumKey);

    const blueprint = key ? CURRICULUM_PRESETS[key as CurriculumKey] : null;

    if (!blueprint) {
      onMatrixChange([]);
      onSelectedBlueprintChange(null);
      return;
    }

    const meta = PRESETS_META.find((m) => m.key === (key as CurriculumKey));

    const rows = createMatrixFromBlueprint(blueprint);
    const disciplinas = getDisciplinasFromBlueprint(blueprint);

    onMatrixChange(rows);
    onSelectedBlueprintChange(
      meta
        ? { key: key as CurriculumKey, label: meta.label, disciplinas }
        : { key: key as CurriculumKey, label: key, disciplinas }
    );
  };

  return (
    <div className="space-y-6">
      {/* Card: Curso / Nível */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg border border-teal-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Qual o Curso/Nível?
            </h3>
            <p className="text-xs text-slate-500">
              Selecione para carregar o plano curricular oficial de Angola.
            </p>
          </div>
        </div>

        {/* Filtros de categoria */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => onPresetCategoryChange("geral")}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border ${
              presetCategory === "geral"
                ? "bg-slate-800 text-white shadow-sm border-slate-800"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            Ensino Geral
          </button>
          <button
            type="button"
            onClick={() => onPresetCategoryChange("tecnico_ind")}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border ${
              presetCategory === "tecnico_ind"
                ? "bg-slate-800 text-white shadow-sm border-slate-800"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            Indústria & Tec
          </button>
          <button
            type="button"
            onClick={() => onPresetCategoryChange("tecnico_serv")}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border ${
              presetCategory === "tecnico_serv"
                ? "bg-slate-800 text-white shadow-sm border-slate-800"
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            Gestão & Serviços
          </button>
          <button
            type="button"
            onClick={() => onPresetCategoryChange("saude")}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border ${
              presetCategory === "saude"
                ? "bg-slate-800 text-white shadow-sm border-slate-800"
                : "bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600"
            }`}
          >
            Saúde
          </button>
          <button
            type="button"
            onClick={() => onPresetCategoryChange("magisterio")}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold transition border ${
              presetCategory === "magisterio"
                ? "bg-slate-800 text-white shadow-sm border-slate-800"
                : "bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600"
            }`}
          >
            Magistério
          </button>
        </div>

        {/* Select de curso */}
        <div className="relative">
          <select
            className="block w-full pl-4 pr-10 py-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white font-medium text-slate-700 cursor-pointer transition-shadow hover:border-teal-400"
            value={curriculumPreset ?? ""}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <option value="">Selecione um curso para começar...</option>
            {filteredPresets.map((meta) => (
              <option key={meta.key} value={meta.key}>
                {meta.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {/* Preview de disciplinas */}
        {selectedBlueprint && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Disciplinas Detetadas
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                {selectedBlueprint.disciplinas.length} Disciplinas
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {selectedBlueprint.disciplinas.map((sub) => (
                <span
                  key={sub}
                  className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Botão aplicar modelo */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onApplyCurriculumPreset}
            disabled={applyingPreset || !selectedBlueprint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {applyingPreset ? "Aplicando..." : "Aplicar modelo"}
          </button>
        </div>
      </div>

      {/* Matriz de turmas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-sm text-slate-700">
              Matriz de Turmas
            </span>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
            {totalTurmas} a criar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-white border-b border-slate-100">
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
              {matrix.map((row) => (
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

        {/* Empty state */}
        {(!selectedBlueprint || matrix.length === 0) && (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-300">
              <ArrowUpCircle className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm font-medium">
              Selecione um curso acima
            </p>
            <p className="text-xs text-slate-400">
              A tabela de turmas aparecerá aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
