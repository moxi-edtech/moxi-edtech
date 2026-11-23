"use client";

import { 
  CalendarRange, 
  ShieldCheck, 
  ImagePlus, 
  Check, 
  CalendarClock, 
  Lock, 
  Loader2,
  Wand2,
  ChevronDown
} from "lucide-react";
import { useState } from "react";

import {
  type AcademicStep1Props,
  type TurnosState,
} from "./academicSetupTypes";

export default function AcademicStep1({
  schoolDisplayName,
  schoolNif,
  schoolPlan,
  setSchoolDisplayName,
  logoUrl,
  onLogoUrlChange,
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
  iban,
  onIbanChange,
  sessaoAtiva,
  periodos,
  creatingSession,
  onCreateSession,
  templates = [],
  onApplyTemplate,
  onApplyRecommendedLocks,
}: AcademicStep1Props) {
  
  const [showTemplates, setShowTemplates] = useState(false);

  // Estilo padrão para inputs
  const inputClass = "w-full rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground outline-none transition-all focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold placeholder:text-muted-foreground";
  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* 1. STATUS DA ENTIDADE */}
      <div className="flex items-start gap-4 rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-klasse-green/10 text-klasse-green dark:text-klasse-green-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-klasse-green dark:text-klasse-green-300">
              Entidade Verificada
            </h3>
            {schoolPlan && (
              <span className="inline-flex items-center rounded-full bg-emerald px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                Plano {schoolPlan}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A entidade <strong className="text-foreground">{schoolDisplayName || "Escola"}</strong> {schoolNif && <span>(NIF: <code className="font-mono text-[10px] bg-card px-1 rounded border border-border">{schoolNif}</code>)</span>} está validada no sistema. <br />
            Esta configuração definirá a base do calendário acadêmico e financeiro.
          </p>
        </div>
      </div>

      {/* NOVO: ATALHO PARA TEMPLATES OFICIAIS */}
      <div className="rounded-2xl border border-amber/20 bg-amber/5 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
           <h3 className="text-sm font-bold text-amber-700 flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Configuração Automática (Recomendado)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Deseja preencher as datas usando o calendário oficial do Ministério da Educação?</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowTemplates(!showTemplates)}
            className="inline-flex items-center gap-2 rounded-xl bg-card border border-amber/30 px-5 py-2.5 text-sm font-bold text-amber shadow-sm transition-all hover:bg-amber/5"
          >
            Importar Modelo Oficial
            <ChevronDown className={`h-4 w-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>

          {showTemplates && (
            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selecione o Modelo</p>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onApplyTemplate?.(t); setShowTemplates(false); }}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-between"
                >
                  {t.ano_base >= 2026 ? `Calendário MED ${t.ano_base}/${t.ano_base + 1}` : t.nome}
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t.ano_base}</span>
                </button>
              ))}
              {templates.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground italic">Nenhum modelo oficial encontrado.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. DADOS PRINCIPAIS */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-8 md:flex-row">
          
          {/* Logo Upload (Visual Engagement) */}
          <div className="group relative flex h-36 w-36 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted transition-all hover:border-klasse-gold hover:bg-klasse-gold/5 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-ring transition-colors group-hover:text-klasse-gold-700 dark:hover:text-klasse-gold-300">
                  <ImagePlus className="h-5 w-5 text-muted-foreground group-hover:text-klasse-gold-700 dark:hover:text-klasse-gold-300" />
                </div>
                <span className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground group-hover:text-klasse-gold-700 dark:hover:text-klasse-gold-300">
                  Carregar Logo
                </span>
              </>
            )}
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
              
              {/* IBAN Principal */}
              <div className="md:col-span-2">
                <label className={labelClass}>IBAN Principal para Pagamentos</label>
                <input
                  value={iban}
                  onChange={(e) => onIbanChange(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="Ex: AO06 0000 0000 0000 0000 0000 0"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Este IBAN aparecerá nas fichas de inscrição e recibos.</p>
              </div>

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
                  <CalendarRange className="absolute left-3.5 top-2.5 h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {/* Regime (Badge Fixo) */}
              <div>
                <label className={labelClass}>Regime Avaliativo</label>
                <div className="flex h-[42px] items-center gap-2 rounded-xl border border-border bg-muted px-4 text-sm font-semibold text-muted-foreground">
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
                  disabled={anoLetivo >= 2026}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fim do Ano</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={anoLetivo >= 2026}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Turnos */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Turnos Operacionais</label>
            </div>
            <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
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
                      ? "border-klasse-green bg-klasse-green text-white shadow-sm ring-2 ring-klasse-green/20"
                      : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted"
                    }
                  `}
                >
                  {active ? <Check className="h-4 w-4" strokeWidth={3} /> : <div className="h-4 w-4 rounded-full border border-border" />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. CONFIGURAÇÃO DE TRIMESTRES */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Períodos Letivos</h3>
            <p className="text-xs text-muted-foreground">Defina as datas de cada trimestre. O bloqueio de notas é sugerido automaticamente 15 dias após cada término.</p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800">Menos preenchimento manual</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
              Se preferir, aplique a regra recomendada para todos os trimestres agora e ajuste apenas casos excepcionais.
            </p>
          </div>
          <button
            type="button"
            onClick={onApplyRecommendedLocks}
            disabled={anoLetivo >= 2026}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-card px-4 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
          >
            Aplicar travas recomendadas
          </button>
        </div>

        <div className="space-y-4">
          {periodosConfig.map((periodo) => (
            <div key={periodo.numero} className="flex flex-col gap-4 rounded-xl border border-border bg-muted/50 p-4 sm:flex-row sm:items-end">
              
              <div className="min-w-[100px] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período</span>
                <p className="font-bold text-foreground">Trimestre {periodo.numero}</p>
              </div>

              <div className="flex-1">
                <label className={labelClass}>Início</label>
                <input
                  type="date"
                  value={periodo.data_inicio}
                  onChange={(e) => onPeriodoChange(periodo.numero, "data_inicio", e.target.value)}
                  disabled={anoLetivo >= 2026}
                  className={`${inputClass} bg-card`}
                />
              </div>

              <div className="flex-1">
                <label className={labelClass}>Término</label>
                <input
                  type="date"
                  value={periodo.data_fim}
                  onChange={(e) => onPeriodoChange(periodo.numero, "data_fim", e.target.value)}
                  disabled={anoLetivo >= 2026}
                  className={`${inputClass} bg-card`}
                />
              </div>

              <div className="flex-1">
                <label className={`${labelClass} text-amber-600`}>Travar Notas</label>
                <input
                  type="datetime-local"
                  value={periodo.trava_notas_em}
                  onChange={(e) => onPeriodoChange(periodo.numero, "trava_notas_em", e.target.value)}
                  disabled={anoLetivo >= 2026}
                  className={`${inputClass} bg-card border-amber-200 focus:border-amber-400 focus:ring-amber-400`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
        
        {/* Status Text */}
        <div className="text-xs text-muted-foreground">
          {sessaoAtiva ? (
            <span className="flex items-center gap-2">
              <Check className="h-3 w-3 text-emerald-500" />
              Sessão ativa: <strong className="text-foreground">{sessaoAtiva.nome}</strong> ({periodos.length} períodos)
            </span>
          ) : (
            <span>Nenhuma sessão criada. Configure acima.</span>
          )}
        </div>

        <button
          type="button"
          onClick={onCreateSession}
          disabled={creatingSession}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-8 py-3 text-sm font-bold text-klasse-gold-900 shadow-md shadow-orange-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
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
