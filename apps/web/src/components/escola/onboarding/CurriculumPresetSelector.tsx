// apps/web/src/components/escola/onboarding/CurriculumPresetSelector.tsx

"use client";

import { useMemo, useState } from "react";
import {
  CURRICULUM_PRESETS,
  type CurriculumKey,
} from "@/lib/onboarding";
import { BookOpen, ChevronDown } from "lucide-react";

type CurriculumCategory =
  | "geral"
  | "tecnico_ind"
  | "tecnico_serv"
  | "saude"
  | "magisterio";

const TABS: { id: CurriculumCategory; label: string }[] = [
  { id: "geral",        label: "Ensino Geral" },
  { id: "tecnico_ind",  label: "Indústria & Tec" },
  { id: "tecnico_serv", label: "Gestão & Serviços" },
  { id: "saude",        label: "Saúde" },
  { id: "magisterio",   label: "Magistério" },
];

type PresetMeta = {
  key: CurriculumKey;
  category: CurriculumCategory;
  label: string;
  badge?: string;
};

const PRESETS_META: PresetMeta[] = [
  // ENSINO GERAL
  { key: "primario_base",       category: "geral", label: "Primário (Base)",    badge: "1ª a 6ª Classe" },
  { key: "primario_avancado",   category: "geral", label: "Primário (Avançado)",badge: "1ª a 6ª Classe" },
  { key: "ciclo1",              category: "geral", label: "1º Ciclo (7ª–9ª)" },
  { key: "puniv",               category: "geral", label: "Ciências Físico-Biológicas" },
  { key: "economicas",          category: "geral", label: "Ciências Económicas e Jurídicas" },

  // TÉCNICO – INDÚSTRIA & TEC
  { key: "tecnico_informatica", category: "tecnico_ind", label: "Técnico de Informática" },
  { key: "tecnico_construcao",  category: "tecnico_ind", label: "Técnico de Construção Civil" },
  { key: "tecnico_base",        category: "tecnico_ind", label: "Técnico (Base Genérica)" },

  // TÉCNICO – GESTÃO & SERVIÇOS
  { key: "tecnico_gestao",      category: "tecnico_serv", label: "Técnico de Gestão / Contabilidade" },

  // SAÚDE
  { key: "saude_enfermagem",        category: "saude", label: "Técnico de Enfermagem" },
  { key: "saude_farmacia_analises", category: "saude", label: "Farmácia / Análises Clínicas" },

  // MAGISTÉRIO – por enquanto vazio (sem presets definidos nessa categoria)
];

interface Props {
  value: CurriculumKey | null;
  onChange: (key: CurriculumKey | null) => void;
}

export function CurriculumPresetSelector({ value, onChange }: Props) {
  const [activeCat, setActiveCat] = useState<CurriculumCategory>("geral");

  const options = useMemo(
    () => PRESETS_META.filter((m) => m.category === activeCat),
    [activeCat]
  );

  return (
    <section className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-800">
            Qual o Curso/Nível?
          </h2>
          <p className="text-xs text-slate-500">
            Selecione para carregar o plano curricular oficial de Angola.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeCat;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveCat(tab.id);
                if (value) {
                  const meta = PRESETS_META.find((m) => m.key === value);
                  if (meta && meta.category !== tab.id) {
                    onChange(null);
                  }
                }
              }}
              className={[
                "px-3 py-2 rounded-lg text-[11px] font-bold border transition-all",
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Select */}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value as CurriculumKey | "";
            onChange(v ? (v as CurriculumKey) : null);
          }}
          className="block w-full pl-4 pr-10 py-3 text-sm border border-emerald-500 rounded-xl
                     focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                     outline-none bg-white font-medium text-slate-700 cursor-pointer
                     transition-shadow"
        >
          <option value="">Selecione um curso para começar...</option>
          {options.map((meta) => {
            const count = CURRICULUM_PRESETS[meta.key].length;
            return (
              <option key={meta.key} value={meta.key}>
                {meta.label} — {count} disciplinas
              </option>
            );
          })}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </span>
      </div>
    </section>
  );
}
