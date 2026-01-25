"use client";

import type { AcademicStep2ConfigProps } from "./academicSetupTypes";

export default function AcademicStep2Config({
  frequenciaModelo,
  onFrequenciaModeloChange,
  frequenciaMinPercent,
  onFrequenciaMinPercentChange,
  modeloAvaliacao,
  onModeloAvaliacaoChange,
  avaliacaoConfig,
}: AcademicStep2ConfigProps) {
  const componentes = avaliacaoConfig?.componentes ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Frequência (SSOT)</h3>
          <p className="text-xs text-slate-500">Fonte única: tabela `frequencias`.</p>
        </div>
        <div className="flex gap-2">
          {(["POR_AULA", "POR_PERIODO"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onFrequenciaModeloChange(opt)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                frequenciaModelo === opt
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {opt === "POR_AULA" ? "Por aula" : "Por período"}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-semibold text-slate-700" htmlFor="frequencia-min-percent">
            % mínimo de presença
          </label>
          <input
            id="frequencia-min-percent"
            type="number"
            min={0}
            max={100}
            value={frequenciaMinPercent}
            onChange={(event) => onFrequenciaMinPercentChange(Number(event.target.value))}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Modelo de avaliação</h3>
          <p className="text-xs text-slate-500">Define o formato de notas trimestrais.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["SIMPLIFICADO", "ANGOLANO_TRADICIONAL", "COMPETENCIAS", "DEPOIS"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onModeloAvaliacaoChange(opt)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                modeloAvaliacao === opt
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {opt === "SIMPLIFICADO"
                ? "Simplificado"
                : opt === "ANGOLANO_TRADICIONAL"
                ? "Angolano tradicional"
                : opt === "COMPETENCIAS"
                ? "Competências"
                : "Definir depois"}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-700">
          <p className="text-xs font-semibold text-slate-600 mb-2">Preview de componentes</p>
          {componentes.length === 0 ? (
            <p className="text-xs text-slate-500">Sem componentes configurados.</p>
          ) : (
            <ul className="space-y-1">
              {componentes.map((item) => (
                <li key={item.code} className="flex items-center justify-between">
                  <span className="font-semibold">{item.code}</span>
                  <span className="text-xs text-slate-500">
                    {item.peso}% {item.ativo ? "ativo" : "inativo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
