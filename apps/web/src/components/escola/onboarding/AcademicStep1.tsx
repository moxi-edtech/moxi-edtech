"use client";

import { CalendarRange, ShieldCheck, ImagePlus } from "lucide-react";

import {
  type AcademicStep1Props,
  type TurnosState,
  type AcademicSession,
  type Periodo,
} from "./academicSetupTypes";

export default function AcademicStep1({
  schoolDisplayName,
  setSchoolDisplayName,
  anoLetivo,
  setAnoLetivo,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  periodosConfig,
  onPeriodoChange,
  turnos,
  onTurnoToggle,
  sessaoAtiva,
  periodos,
  creatingSession,
  onCreateSession,
}: AcademicStep1Props) {
  return (
    <div className="space-y-6">
      {/* Entidade validada */}
      <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
        <div className="p-2 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-100">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Entidade Validada
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            A entidade <strong>{schoolDisplayName}</strong> está
            verificada. <br />
            Todos os documentos financeiros serão emitidos com estes
            dados.
          </p>
        </div>
      </div>

      {/* Card principal */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Logo */}
          <div className="group relative w-32 h-32 shrink-0 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/10 transition duration-300">
            <ImagePlus className="w-6 h-6 text-slate-400 group-hover:text-teal-500 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-teal-600">
              Carregar Logo
            </span>
          </div>

          {/* Nome, ano letivo, sistema avaliativo */}
          <div className="flex-1 w-full space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Nome de Exibição
              </label>
              <input
                value={schoolDisplayName}
                onChange={(e) => setSchoolDisplayName(e.target.value)}
                className="w-full text-xl font-bold border-b-2 border-slate-200 py-2 focus:border-teal-500 outline-none bg-transparent transition-colors text-slate-800 placeholder-slate-300"
                placeholder="Nome da escola"
                readOnly
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Ano Letivo
                </label>
                <div className="flex items-center gap-2 mt-2 border-b-2 border-slate-200 py-2 focus-within:border-teal-500 transition-colors">
                  <CalendarRange className="w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={anoLetivo}
                    onChange={(e) => setAnoLetivo(parseInt(e.target.value, 10))}
                    className="font-bold outline-none w-full bg-transparent text-sm text-slate-700"
                    placeholder="2024"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Sistema Avaliativo
                </label>
                <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  Trimestral (Angola)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Data início do ano
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Data fim do ano
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Turnos */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Turnos da Escola
            </label>
            <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-1 rounded font-medium">
              Define as colunas da matriz de turmas
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {(["Manhã", "Tarde", "Noite"] as (keyof TurnosState)[]).map((t) => {
              const active = turnos[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTurnoToggle(t)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2 ${
                    active
                      ? "bg-white border-teal-500 text-teal-700 ring-1 ring-teal-500 shadow-sm"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {active ? (
                    <span className="w-3 h-3 rounded-full bg-teal-500" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-slate-300" />
                  )}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Períodos letivos (Trimestres)</h3>
            <p className="text-xs text-slate-500">Edite datas e travas de notas.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {periodosConfig.map((periodo) => (
            <div key={periodo.numero} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="text-sm font-semibold text-slate-700">Trimestre {periodo.numero}</div>
              <input
                type="date"
                value={periodo.data_inicio}
                onChange={(e) => onPeriodoChange(periodo.numero, "data_inicio", e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={periodo.data_fim}
                onChange={(e) => onPeriodoChange(periodo.numero, "data_fim", e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={periodo.trava_notas_em}
                onChange={(e) => onPeriodoChange(periodo.numero, "trava_notas_em", e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Botão para criar sessão */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCreateSession}
          disabled={creatingSession}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-md hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creatingSession ? <>A criar sessão...</> : <>Criar sessão académica</>}
        </button>
      </div>

      {/* Resumo rápido da sessão */}
      {sessaoAtiva && (
        <div className="text-xs text-slate-500">
          Sessão ativa:{" "}
          <span className="font-semibold">
            {sessaoAtiva.nome || "—"}
          </span>{" "}
          • Períodos:{" "}
          <span className="font-semibold">
            {periodos.length}
          </span>
        </div>
      )}
    </div>
  );
}
