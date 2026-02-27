"use client";

import { useMemo, useState } from "react";
import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
} from "@/lib/onboarding";
import { usePresetsCatalog, usePresetsMeta, usePresetSubjects } from "@/hooks/usePresetSubjects";
import { BookOpen, ChevronDown, Check, Info } from "lucide-react";
import {
  PRESET_TO_TYPE,
  TYPE_ICONS,
  TYPE_COLORS,
  getTypeLabel,
} from "@/lib/courseTypes";

type CurriculumCategory = "geral" | "tecnico";

const TABS: { id: CurriculumCategory; label: string; description: string }[] = [
  {
    id: "geral",
    label: "Ensino Geral",
    description: "Currículos padrão do sistema educativo",
  },
  {
    id: "tecnico",
    label: "Ensino Técnico",
    description: "Cursos técnicos profissionais",
  },
];

// Mapeamento presets → categorias UI
const PRESET_CATEGORIES: Record<CurriculumKey, CurriculumCategory> = {
  // Geral
  primario_generico: "geral",
  esg_ciclo1: "geral",
  esg_puniv_cfb: "geral",
  esg_puniv_cej: "geral",
  esg_puniv_cch: "geral",
  esg_puniv_artes: "geral",

  // Técnico (inclui saúde)
  tec_contabilidade: "tecnico",
  tec_informatica_gestao: "tecnico",
  tec_recursos_humanos: "tecnico",
  tec_secretariado: "tecnico",
  tec_financas: "tecnico",
  tec_comercio: "tecnico",
  tec_saude_analises: "tecnico",
  tec_saude_enfermagem: "tecnico",
  tec_saude_estomatologia: "tecnico",
  tec_saude_farmacia: "tecnico",
  tec_saude_fisioterapia: "tecnico",
  tec_saude_nutricao: "tecnico",
  tec_saude_radiologia: "tecnico",
  tec_construcao_civil: "tecnico",
  tec_energia_eletrica: "tecnico",
  tec_mecanica_manut: "tecnico",
  tec_informatica_sistemas: "tecnico",
  tec_desenhador_projectista: "tecnico",
  tec_electronica_telecom: "tecnico",
  tec_electronica_automacao: "tecnico",
  tec_energias_renovaveis: "tecnico",
  tec_geologia_petroleo: "tecnico",
  tec_perfuracao_producao: "tecnico",
  tec_minas: "tecnico",
  tec_producao_metalomecanica: "tecnico",
  tec_informatica: "tecnico",
  tec_gestao_sistemas: "tecnico",
};

interface Props {
  value: CurriculumKey | null;
  onChange: (key: CurriculumKey | null) => void;
  showSelectionSummary?: boolean;
  disabled?: boolean;
}

export function CurriculumPresetSelector({
  value,
  onChange,
  showSelectionSummary = true,
  disabled = false,
}: Props) {
  const [activeCat, setActiveCat] = useState<CurriculumCategory>("geral");

  // Opções da categoria ativa
  const options = useMemo(() => {
  return Object.entries(CURRICULUM_PRESETS_META)
    .filter(([key]) => PRESET_CATEGORIES[key as CurriculumKey] === activeCat)
    .map(([key, meta]) => {
      // remove qualquer 'key' que venha de meta, pra não duplicar
      const { key: _ignore, ...rest } = meta as any;
      return { key: key as CurriculumKey, ...rest };
    });
}, [activeCat]);


  // Contagem de presets por categoria (para mostrar nas tabs)
  const tabCounts = useMemo(() => {
    const acc: Record<CurriculumCategory, number> = {
      geral: 0,
      tecnico: 0,
    };

    Object.keys(CURRICULUM_PRESETS_META).forEach((key) => {
      const cat = PRESET_CATEGORIES[key as CurriculumKey];
      if (cat) acc[cat] += 1;
    });

    return acc;
  }, []);

  const selectedType = value ? PRESET_TO_TYPE[value] : null;
  const SelectedIcon =
    selectedType && TYPE_ICONS[selectedType] ? TYPE_ICONS[selectedType] : BookOpen;
  const selectedColors =
    selectedType && TYPE_COLORS[selectedType]
      ? TYPE_COLORS[selectedType]
      : TYPE_COLORS.geral;

  const presetKeys = useMemo(() => options.map((option) => option.key), [options]);
  const { metaMap: presetsMeta } = usePresetsMeta(presetKeys);
  const { catalogMap: presetsCatalog } = usePresetsCatalog(presetKeys);
  const selectedMeta = value ? CURRICULUM_PRESETS_META[value] : null;
  const selectedCatalog = value ? presetsCatalog[value] : null;
  const { subjects: subjectsPreview } = usePresetSubjects(value ?? null);

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
            <span className="block mt-1 text-emerald-600">
              <Check className="inline w-3 h-3 mr-1" />
              Depois você poderá personalizar no painel de configurações.
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeCat;
          const tabCount = tabCounts[tab.id] ?? 0;

          return (
            <button
              key={tab.id}
              disabled={disabled}
              type="button"
              onClick={() => {
                setActiveCat(tab.id);
                // Se mudar de categoria e o preset selecionado for de outra, limpa seleção
                if (value && PRESET_CATEGORIES[value] !== tab.id) {
                  onChange(null);
                }
              }}
              className={[
                "px-3 py-2 rounded-lg text-[11px] font-bold border transition-all flex flex-col items-start",
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                disabled ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              <span
                className={[
                  "text-[10px] font-normal mt-0.5",
                  isActive ? "text-slate-300" : "text-slate-400",
                ].join(" ")}
              >
                {tabCount} opção{tabCount !== 1 ? "es" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Select */}
      <div className="relative">
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value as CurriculumKey | "";
            onChange(v ? v : null);
          }}
          className="block w-full pl-4 pr-10 py-3 text-sm border border-emerald-500 rounded-xl
                     focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                     outline-none bg-white font-medium text-slate-700 cursor-pointer
                     transition-shadow hover:shadow-md"
        >
          <option value="" className="text-slate-400">
            {options.length === 0
              ? "Nenhuma opção nesta categoria..."
              : "Selecione um curso para começar..."}
          </option>
          {options.map((meta) => {
            const type = PRESET_TO_TYPE[meta.key];
            const typeLabel = type ? getTypeLabel(type) : "Geral";

            const subjectsCount = presetsMeta[meta.key]?.subjectsCount;
            const catalog = presetsCatalog[meta.key];
            const label = catalog?.name ?? meta.label;
            const badge = catalog?.badge ?? meta.badge;
            const recommended = catalog?.recommended ?? meta.recommended;
            const infoParts = [
              typeof subjectsCount === "number" ? `${subjectsCount} disciplinas` : null,
              typeLabel,
              badge,
              recommended ? "Recomendado" : null,
            ].filter(Boolean);

            return (
              <option key={meta.key} value={meta.key}>
                {label}
                {infoParts.length > 0 ? ` • ${infoParts.join(" • ")}` : ""}
              </option>
            );
          })}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </span>
      </div>

      {/* Resumo da Seleção */}
      {showSelectionSummary && selectedMeta && selectedType && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg ${selectedColors.bgLight} border ${selectedColors.border} flex items-center justify-center`}
              >
                <SelectedIcon className={`w-4 h-4 ${selectedColors.text}`} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-emerald-800">
                    {selectedCatalog?.name ?? selectedMeta.label}
                  </h3>
                  <span
                    className={`px-2 py-0.5 ${selectedColors.bgLight} ${selectedColors.text} text-[10px] font-bold rounded-full`}
                  >
                    {selectedType.toUpperCase()}
                  </span>
                  {(selectedCatalog?.badge ?? selectedMeta.badge) && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                      {selectedCatalog?.badge ?? selectedMeta.badge}
                    </span>
                  )}
                </div>

                {(selectedCatalog?.description ?? selectedMeta.description) && (
                  <p className="text-xs text-emerald-600">
                    {selectedCatalog?.description ?? selectedMeta.description}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {subjectsPreview.length} disciplinas
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600 font-medium">
                    Personalizável depois
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview rápido das disciplinas */}
          {subjectsPreview.length > 0 && (
            <details className="mt-2 group">
              <summary className="text-xs text-slate-500 cursor-pointer list-none flex items-center gap-1">
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                Ver disciplinas incluídas (
                {Math.min(
                  subjectsPreview.length,
                  subjectsPreview.length
                )}
                )
              </summary>
              <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-1">
                  {subjectsPreview.slice(0, 9).map((subject, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-600 px-2 py-1 bg-white rounded border border-slate-100"
                    >
                      {subject.name}
                    </li>
                  ))}
                  {subjectsPreview.length > 9 && (
                    <li className="text-xs text-slate-400 px-2 py-1 italic">
                      +{subjectsPreview.length - 9} mais...
                    </li>
                  )}
                </ul>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Informação de ajuda */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <p>
            Não encontra o que precisa? Você poderá criar cursos personalizados
            e adicionar disciplinas extras no painel de configurações da escola.
          </p>
        </div>
      </div>
    </section>
  );
}
