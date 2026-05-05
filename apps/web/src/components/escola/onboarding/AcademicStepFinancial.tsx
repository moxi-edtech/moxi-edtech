"use client";

import { 
  Banknote, 
  CreditCard, 
  CalendarDays, 
  ShieldCheck,
  Info
} from "lucide-react";
import { type AcademicStepFinancialProps } from "./academicSetupTypes";

export default function AcademicStepFinancial({
  valorMatricula,
  onValorMatriculaChange,
  valorMensalidade,
  onValorMensalidadeChange,
  diaVencimento,
  onDiaVencimentoChange,
  isLoading
}: AcademicStepFinancialProps) {
  
  const inputClass = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition-all focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C] placeholder:text-slate-300";
  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* 1. INTRODUÇÃO FINANCEIRA */}
      <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-blue-900">
            Definição de Preçário Base
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-blue-800">
            Estes valores serão aplicados automaticamente às turmas geradas. <br />
            Poderá ajustar os preços individualmente por curso ou classe após concluir o setup.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        {/* 2. VALOR DA MATRÍCULA */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Inscrição / Matrícula</h3>
          </div>
          
          <div>
            <label className={labelClass}>Valor Padrão (Kz)</label>
            <div className="relative">
              <input
                type="number"
                value={valorMatricula}
                onChange={(e) => onValorMatriculaChange(Number(e.target.value))}
                className={inputClass}
                placeholder="Ex: 5000"
              />
              <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">Kz</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 italic">
              Valor cobrado no ato da confirmação ou matrícula inicial.
            </p>
          </div>
        </div>

        {/* 3. MENSALIDADE PADRÃO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Banknote className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Propina / Mensalidade</h3>
          </div>
          
          <div>
            <label className={labelClass}>Valor Mensal (Kz)</label>
            <div className="relative">
              <input
                type="number"
                value={valorMensalidade}
                onChange={(e) => onValorMensalidadeChange(Number(e.target.value))}
                className={inputClass}
                placeholder="Ex: 15000"
              />
              <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">Kz</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 italic">
              Valor que servirá de base para os 10 meses do ano letivo.
            </p>
          </div>
        </div>

      </div>

      {/* 4. CONFIGURAÇÃO DE PAGAMENTO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Políticas de Vencimento</h3>
            <p className="text-xs text-slate-500">Determine as regras de cobrança automática.</p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className={labelClass}>Dia de Vencimento Mensal</label>
          <select 
            value={diaVencimento}
            onChange={(e) => onDiaVencimentoChange(Number(e.target.value))}
            className={inputClass}
          >
            {[5, 10, 15, 20, 25, 28].map((dia) => (
              <option key={dia} value={dia}>Dia {dia} de cada mês</option>
            ))}
          </select>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            As faturas de mensalidade serão geradas automaticamente com este prazo.
          </p>
        </div>
      </div>

      {/* 5. SEGURANÇA */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-100/50 p-4">
        <ShieldCheck className="h-4 w-4 text-slate-400" />
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Estes dados alimentam os Recibos e Faturas certificados pela AGT.
        </p>
      </div>

    </div>
  );
}
