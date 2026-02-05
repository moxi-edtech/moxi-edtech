"use client";

import { 
  CalendarRange, 
  ShieldCheck, 
  ImagePlus, 
  Check, 
  CalendarClock, 
  Lock, 
  Loader2 
} from "lucide-react";

import {
  type AcademicStep1Props,
  type TurnosState,
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
  
  // Estilo padrão para inputs
  const inputClass = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition-all focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C] placeholder:text-slate-300";
  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. STATUS DA ENTIDADE */}
      <div className="flex items-start gap-4 rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#1F6B3B]">
            Entidade Verificada
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            A entidade <strong className="text-slate-900">{schoolDisplayName || "Escola"}</strong> está validada no sistema. <br />
            Esta configuração definirá a base do calendário acadêmico e financeiro.
          </p>
        </div>
      </div>

      {/* 2. DADOS PRINCIPAIS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-8 md:flex-row">
          
          {/* Logo Upload (Visual) */}
          <div className="group relative flex h-36 w-36 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-[#E3B23C] hover:bg-[#E3B23C]/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100 transition-colors group-hover:text-[#E3B23C]">
              <ImagePlus className="h-5 w-5 text-slate-400 group-hover:text-[#E3B23C]" />
            </div>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-[#E3B23C]">
              Carregar Logo
            </span>
          </div>

          {/* Form Fields */}
          <div className="flex-1 space-y-6">
            
            {/* Nome */}
            <div>
              <label className={labelClass}>Nome de Exibição</label>
              <input
                value={schoolDisplayName}
                onChange={(e) => setSchoolDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Ex: Colégio KLASSE Internacional"
                readOnly
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              
              {/* Ano Letivo */}
              <div>
                <label className={labelClass}>Ano Letivo</label>
                <div className="relative">
                  <input
                    type="number"
                    value={anoLetivo}
                    onChange={(e) => setAnoLetivo(parseInt(e.target.value, 10))}
                    className={`${inputClass} pl-10`}
                    placeholder="2024"
                  />
                  <CalendarRange className="absolute left-3.5 top-2.5 h-5 w-5 text-slate-400" />
                </div>
              </div>

              {/* Regime (Badge Fixo) */}
              <div>
                <label className={labelClass}>Regime Avaliativo</label>
                <div className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500">
                  <Lock className="h-3.5 w-3.5 opacity-50" />
                  Trimestral (Padrão Angola)
                </div>
              </div>

              {/* Datas Globais */}
              <div>
                <label className={labelClass}>Início do Ano</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fim do Ano</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Turnos */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Turnos Operacionais</label>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
              Define a estrutura das turmas
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
                  className={`
                    flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition-all
                    ${active
                      ? "border-[#1F6B3B] bg-[#1F6B3B] text-white shadow-sm ring-2 ring-[#1F6B3B]/20"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                >
                  {active ? <Check className="h-4 w-4" strokeWidth={3} /> : <div className="h-4 w-4 rounded-full border border-slate-300" />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. CONFIGURAÇÃO DE TRIMESTRES */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Períodos Letivos</h3>
            <p className="text-xs text-slate-500">Defina as datas de cada trimestre e o bloqueio de notas.</p>
          </div>
        </div>

        <div className="space-y-4">
          {periodosConfig.map((periodo) => (
            <div key={periodo.numero} className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-end">
              
              <div className="min-w-[100px] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Período</span>
                <p className="font-bold text-slate-800">Trimestre {periodo.numero}</p>
              </div>

              <div className="flex-1">
                <label className={labelClass}>Início</label>
                <input
                  type="date"
                  value={periodo.data_inicio}
                  onChange={(e) => onPeriodoChange(periodo.numero, "data_inicio", e.target.value)}
                  className={`${inputClass} bg-white`}
                />
              </div>

              <div className="flex-1">
                <label className={labelClass}>Término</label>
                <input
                  type="date"
                  value={periodo.data_fim}
                  onChange={(e) => onPeriodoChange(periodo.numero, "data_fim", e.target.value)}
                  className={`${inputClass} bg-white`}
                />
              </div>

              <div className="flex-1">
                <label className={`${labelClass} text-amber-600`}>Travar Notas</label>
                <input
                  type="datetime-local"
                  value={periodo.trava_notas_em}
                  onChange={(e) => onPeriodoChange(periodo.numero, "trava_notas_em", e.target.value)}
                  className={`${inputClass} bg-white border-amber-200 focus:border-amber-400 focus:ring-amber-400`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row">
        
        {/* Status Text */}
        <div className="text-xs text-slate-500">
          {sessaoAtiva ? (
            <span className="flex items-center gap-2">
              <Check className="h-3 w-3 text-emerald-500" />
              Sessão ativa: <strong className="text-slate-900">{sessaoAtiva.nome}</strong> ({periodos.length} períodos)
            </span>
          ) : (
            <span>Nenhuma sessão criada. Configure acima.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onCreateSession}
          disabled={creatingSession}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
        >
          {creatingSession ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              {sessaoAtiva ? "Atualizar Sessão" : "Criar Sessão Acadêmica"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}