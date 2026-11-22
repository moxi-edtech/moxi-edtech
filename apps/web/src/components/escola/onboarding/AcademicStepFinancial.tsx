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
  pricingRules,
  onPricingRuleChange,
  onApplyDefaultsToAll,
  isLoading
}: AcademicStepFinancialProps) {
  
  const inputClass = "w-full rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground outline-none transition-all focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold placeholder:text-muted-foreground";
  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

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
            Defina um preço base e confirme explicitamente cada combinação de curso e classe. <br />
            O setup vai gravar uma tabela global e, quando necessário, valores específicos por curso/classe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        
        {/* 2. VALOR DA MATRÍCULA */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Inscrição / Matrícula</h3>
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
              <span className="absolute right-4 top-2.5 text-xs font-bold text-muted-foreground">Kz</span>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Valor cobrado no ato da confirmação ou matrícula inicial.
            </p>
          </div>
        </div>

        {/* 3. MENSALIDADE PADRÃO */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Banknote className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Propina / Mensalidade</h3>
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
              <span className="absolute right-4 top-2.5 text-xs font-bold text-muted-foreground">Kz</span>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Valor que servirá de base para os 10 meses do ano letivo.
            </p>
          </div>
        </div>

      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Preçário por Curso e Classe</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Revise cada combinação da matriz académica para evitar preços ambíguos.
            </p>
          </div>
          <button
            type="button"
            onClick={onApplyDefaultsToAll}
            disabled={isLoading || pricingRules.length === 0}
            className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Aplicar preço base a todas
          </button>
        </div>

        {pricingRules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            Defina primeiro a matriz académica para gerar linhas de preço por curso e classe.
          </div>
        ) : (
          <div className="space-y-3">
            {pricingRules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/70 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Destino</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{rule.classeNome}</p>
                  <p className="text-xs text-muted-foreground">{rule.cursoNome}</p>
                </div>

                <div>
                  <label className={labelClass}>Matrícula (Kz)</label>
                  <input
                    type="number"
                    value={rule.valorMatricula}
                    onChange={(e) => onPricingRuleChange(rule.id, "valorMatricula", Number(e.target.value))}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className={labelClass}>Mensalidade (Kz)</label>
                  <input
                    type="number"
                    value={rule.valorMensalidade}
                    onChange={(e) => onPricingRuleChange(rule.id, "valorMensalidade", Number(e.target.value))}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CONFIGURAÇÃO DE PAGAMENTO */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Políticas de Vencimento</h3>
            <p className="text-xs text-muted-foreground">Determine as regras de cobrança automática.</p>
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
          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            As faturas de mensalidade serão geradas automaticamente com este prazo.
          </p>
        </div>
      </div>

      {/* 5. SEGURANÇA */}
      <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Estes dados alimentam os Recibos e Faturas certificados pela AGT.
        </p>
      </div>

    </div>
  );
}
