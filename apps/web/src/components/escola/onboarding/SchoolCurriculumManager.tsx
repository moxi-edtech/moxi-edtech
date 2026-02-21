"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Info,
} from "lucide-react";

import type { DisciplineComponent } from "@/lib/academico/curriculum-presets";

export type BaseCurriculumSubject = {
  id: string;
  name: string;
  baseHours: number;
  component: DisciplineComponent;
};

type Props = {
  courseName: string;
  gradeLevel: string;
  baseCurriculum: BaseCurriculumSubject[];
  initialOverrides?: Record<string, number>;
  onSave: (overrides: Record<string, number>) => Promise<void>;
  onCancel: () => void;
  className?: string;
};

export function SchoolCurriculumManager({
  courseName,
  gradeLevel,
  baseCurriculum,
  initialOverrides = {},
  onSave,
  onCancel,
  className,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>(initialOverrides);

  useEffect(() => {
    setOverrides(initialOverrides);
  }, [initialOverrides]);

  const handleHourChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (Number.isNaN(numValue) || numValue < 0) return;

    setOverrides((prev) => ({
      ...prev,
      [id]: numValue,
    }));
  };

  const handleRestoreDefaults = () => {
    if (
      window.confirm(
        "Tem certeza que deseja restaurar a carga horária padrão do MED? Todas as customizações desta classe serão perdidas."
      )
    ) {
      setOverrides({});
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadToSave: Record<string, number> = {};
      baseCurriculum.forEach((subject) => {
        const customValue = overrides[subject.id];
        if (customValue !== undefined && customValue !== subject.baseHours) {
          payloadToSave[subject.id] = customValue;
        }
      });

      await onSave(payloadToSave);
    } catch (error) {
      console.error("Erro ao salvar configuração", error);
    } finally {
      setSaving(false);
    }
  };

  const groupedCurriculum = useMemo(() => {
    return baseCurriculum.reduce((acc, subject) => {
      if (!acc[subject.component]) acc[subject.component] = [];
      acc[subject.component].push(subject);
      return acc;
    }, {} as Record<string, BaseCurriculumSubject[]>);
  }, [baseCurriculum]);

  const totalBaseHours = baseCurriculum.reduce((sum, s) => sum + s.baseHours, 0);
  const totalCustomHours = baseCurriculum.reduce(
    (sum, s) => sum + (overrides[s.id] ?? s.baseHours),
    0
  );

  const ValidationStatus = ({ base, custom }: { base: number; custom: number }) => {
    if (custom === base) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Conforme Legal
        </span>
      );
    }
    if (custom > base) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3B23C]/30 bg-[#E3B23C]/10 px-2.5 py-1 text-xs font-semibold text-[#9E6F12]">
          <ArrowUpCircle className="h-3.5 w-3.5" />
          Carga Reforçada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        Abaixo do Mínimo
      </span>
    );
  };

  if (baseCurriculum.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className ?? ""}`}>
        <h2 className="text-lg font-bold text-slate-800">Sem disciplinas para esta classe.</h2>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className ?? ""}`}>
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-1 text-xl font-bold text-[#1F6B3B]">Gestão da Matriz Curricular</h2>
          <p className="text-sm font-medium text-slate-500">
            {courseName} — {gradeLevel}
          </p>
        </div>

        <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400">Total Padrão MED</span>
            <span className="text-lg font-bold text-slate-700">{totalBaseHours}h</span>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#1F6B3B]">Total da Escola</span>
            <span
              className={`text-lg font-bold ${
                totalCustomHours < totalBaseHours ? "text-red-600" : "text-[#1F6B3B]"
              }`}
            >
              {totalCustomHours}h
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <p>
          Ajuste a carga horária de acordo com o regime da escola. Valores abaixo do padrão do Ministério da
          Educação (MED) gerarão alertas críticos na emissão de certificados, mas podem ser salvos se houver
          um despacho de excepção justificado para a instituição.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedCurriculum).map(([componentName, subjects]) => (
          <div key={componentName} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Componente {componentName.replace(/_/g, " ")}
              </h3>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-white text-xs text-slate-400">
                <tr>
                  <th className="w-1/2 p-4 font-medium">Disciplina</th>
                  <th className="w-1/6 p-4 text-center font-medium">Padrão (MED)</th>
                  <th className="w-1/6 p-4 text-center font-medium">Aulas/Semana</th>
                  <th className="w-1/6 p-4 text-right font-medium">Status de Conformidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((disc) => {
                  const customHours = overrides[disc.id] ?? disc.baseHours;
                  const isModified = customHours !== disc.baseHours;

                  return (
                    <tr key={disc.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="p-4">
                        <span className="font-semibold text-slate-700">{disc.name}</span>
                        {isModified && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                            Customizado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-medium text-slate-500">{disc.baseHours}</span>
                      </td>
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          value={customHours}
                          onChange={(e) => handleHourChange(disc.id, e.target.value)}
                          className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20"
                          min={0}
                          max={20}
                        />
                      </td>
                      <td className="p-4 text-right">
                        <ValidationStatus base={disc.baseHours} custom={customHours} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
        <button
          onClick={handleRestoreDefaults}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar Padrão do MED
        </button>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#E3B23C] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Matriz da Escola"}
          </button>
        </div>
      </div>
    </div>
  );
}
