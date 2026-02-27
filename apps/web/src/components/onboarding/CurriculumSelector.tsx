"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import type { CurriculumKey } from "@/lib/onboarding";
import {
  CURRICULUM_PRESETS_META,
} from "@/lib/onboarding";
import { PRESET_TO_TYPE } from "@/lib/courseTypes";
import { BookOpen, Briefcase, Layers, Check } from "lucide-react";
import { usePresetCounts } from "@/hooks/usePresetCounts";
import { usePresetsCatalog } from "@/hooks/usePresetSubjects";

interface CurriculumPresetSelectorProps {
  value: CurriculumKey | null;
  onChange: (key: CurriculumKey) => void;
}

type GroupId = "basico" | "tecnico";

const ICONS_BY_GROUP: Record<
  GroupId,
  ComponentType<{ className?: string; size?: number }>
> = {
  basico: BookOpen,
  tecnico: Briefcase,
};


const GROUP_LABELS: Record<GroupId, string> = {
  basico: "Ensino Geral",
  tecnico: "Ensino Técnico / Profissional",
};

type PresetCard = {
  key: CurriculumKey;
  title: string;
  badge?: string;
  desc?: string;
  group: GroupId;
};

const GROUP_BY_PRESET: Partial<Record<CurriculumKey, GroupId>> = {};

export function CurriculumPresetSelector({
  value,
  onChange,
}: CurriculumPresetSelectorProps) {
  const { counts, loading: countsLoading } = usePresetCounts();
  const presetKeys = useMemo(
    () => Object.keys(CURRICULUM_PRESETS_META) as CurriculumKey[],
    []
  );
  const { catalogMap: presetsCatalog } = usePresetsCatalog(presetKeys);
  const grouped = useMemo(() => {
    const groups: Record<GroupId, PresetCard[]> = {
      basico: [],
      tecnico: [],
    };

    const resolveGroup = (key: CurriculumKey): GroupId => {
      if (GROUP_BY_PRESET[key]) return GROUP_BY_PRESET[key] as GroupId;
      const type = PRESET_TO_TYPE[key];
      return type && type.startsWith("tecnico") ? "tecnico" : "basico";
    };

    (Object.entries(CURRICULUM_PRESETS_META) as [
      CurriculumKey,
      (typeof CURRICULUM_PRESETS_META)[CurriculumKey]
    ][]).forEach(([key, meta]) => {
      const group = resolveGroup(key);
      const catalog = presetsCatalog[key];
      groups[group].push({
        key,
        title: catalog?.name ?? meta.label,
        badge: catalog?.badge ?? meta.badge,
        desc: catalog?.description ?? meta.description,
        group,
      });
    });

    return groups;
  }, [presetsCatalog]);

  return (
    <section className="w-full space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          Plano Curricular Base
        </h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Selecione um modelo curricular de referência. Depois você poderá
          ajustar disciplinas, remover ou adicionar conforme a realidade da escola.
        </p>
      </div>

      {(Object.keys(grouped) as GroupId[]).map((groupId) => {
        const Icon = ICONS_BY_GROUP[groupId];
        const items = grouped[groupId];
        if (!items.length) return null;

        return (
          <div key={groupId} className="space-y-4">
            {/* Título do grupo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Icon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {GROUP_LABELS[groupId]}
                </h3>
                <p className="text-xs text-slate-500">
                  Modelos de currículo mais usados neste segmento
                </p>
              </div>
            </div>

            {/* Grid de cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((preset) => {
                const isSelected = value === preset.key;
                const disciplinesCount = counts[preset.key] ?? 0;

                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => onChange(preset.key)}
                    className={[
                      "relative flex flex-col items-start text-left p-4 md:p-5 rounded-2xl border transition-all duration-200",
                      "hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
                      isSelected
                        ? "border-blue-500 bg-blue-50/60 shadow-sm"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    {/* Check no canto */}
                    <span
                      className={[
                        "absolute top-3 right-3 inline-flex items-center justify-center rounded-full border w-6 h-6 text-xs",
                        isSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white border-slate-300 text-transparent",
                      ].join(" ")}
                    >
                      <Check size={14} />
                    </span>

                    {/* Título + badge */}
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {preset.title}
                        </span>
                        {preset.badge && (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {preset.badge}
                          </span>
                        )}
                      </div>
                      {preset.desc && (
                        <p className="text-xs text-slate-500">
                          {preset.desc}
                        </p>
                      )}
                    </div>

                    {/* Meta / estatísticas */}
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <Layers size={12} className="text-slate-400" />
                        <span>{countsLoading ? "—" : `${disciplinesCount} disciplinas`}</span>
                      </span>
                      <span className="truncate">
                        Baseada nas diretrizes do sistema angolano
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
