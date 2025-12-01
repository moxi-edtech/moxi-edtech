"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import type { CurriculumKey } from "@/lib/onboarding";
import { CURRICULUM_PRESETS } from "@/lib/onboarding";
import {
  BookOpen,
  Briefcase,
  Stethoscope,
  Layers,
  Check,
} from "lucide-react";

interface CurriculumPresetSelectorProps {
  value: CurriculumKey | null;
  onChange: (key: CurriculumKey) => void;
}

type GroupId = "basico" | "tecnico" | "saude";

interface PresetMeta {
  key: CurriculumKey;
  title: string;
  badge?: string;
  desc?: string;
  group: GroupId;
}

const ICONS_BY_GROUP: Record<
  GroupId,
  ComponentType<{ className?: string; size?: number }>
> = {
  basico: BookOpen,
  tecnico: Briefcase,
  saude: Stethoscope,
};


const GROUP_LABELS: Record<GroupId, string> = {
  basico: "Ensino Geral",
  tecnico: "Ensino Técnico / Profissional",
  saude: "Ensino Técnico de Saúde",
};

// Mapeamento semântico das keys para a UI
const PRESETS_META: PresetMeta[] = [
  // Básico
  {
    key: "primario_base",
    title: "Primário (Base)",
    badge: "1ª a 6ª Classe",
    desc: "Currículo enxuto para escolas de base",
    group: "basico",
  },
  {
    key: "primario_avancado",
    title: "Primário (Avançado)",
    badge: "1ª a 6ª Classe",
    desc: "Inclui Ciências, História e Geografia",
    group: "basico",
  },
  {
    key: "ciclo1",
    title: "1º Ciclo",
    badge: "7ª a 9ª Classe",
    desc: "Línguas, Ciências e Humanidades",
    group: "basico",
  },
  {
    key: "puniv",
    title: "Ciências Físico-Biológicas",
    badge: "IIº Ciclo",
    desc: "Ramo científico para acesso ao ensino superior",
    group: "basico",
  },
  {
    key: "economicas",
    title: "Ciências Económicas e Jurídicas",
    badge: "IIº Ciclo",
    desc: "Base para cursos de Gestão, Direito, Economia",
    group: "basico",
  },

  // Técnico
  {
    key: "tecnico_informatica",
    title: "Técnico de Informática",
    badge: "Muito popular",
    desc: "Programação, redes, sistemas e projecto",
    group: "tecnico",
  },
  {
    key: "tecnico_gestao",
    title: "Técnico de Gestão / Contabilidade",
    badge: "Administração",
    desc: "Contabilidade, fiscalidade e gestão",
    group: "tecnico",
  },
  {
    key: "tecnico_construcao",
    title: "Técnico de Construção Civil",
    badge: "Obras",
    desc: "Desenho, materiais, topografia e estabilidade",
    group: "tecnico",
  },
  {
    key: "tecnico_base",
    title: "Técnico (Base Genérica)",
    badge: "Modelo genérico",
    desc: "Bloco padrão para técnicos não listados",
    group: "tecnico",
  },

  // Saúde
  {
    key: "saude_enfermagem",
    title: "Técnico de Enfermagem",
    badge: "Saúde",
    desc: "Fundamentos, comunitária, materno-infantil",
    group: "saude",
  },
  {
    key: "saude_farmacia_analises",
    title: "Farmácia / Análises Clínicas",
    badge: "Saúde",
    desc: "Microbiologia, bioquímica, imunologia",
    group: "saude",
  },
];

export function CurriculumPresetSelector({
  value,
  onChange,
}: CurriculumPresetSelectorProps) {
  const grouped = useMemo(() => {
    const groups: Record<GroupId, PresetMeta[]> = {
      basico: [],
      tecnico: [],
      saude: [],
    };
    for (const meta of PRESETS_META) {
      groups[meta.group].push(meta);
    }
    return groups;
  }, []);

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
                const disciplinesCount =
                  CURRICULUM_PRESETS[preset.key].length;

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
                        <span>{disciplinesCount} disciplinas</span>
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
