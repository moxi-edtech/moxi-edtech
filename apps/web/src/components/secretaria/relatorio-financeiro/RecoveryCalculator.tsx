"use client";

import React, { useState } from "react";
import { kwanza } from "./utils";
import { Calculator, ArrowRight, TrendingUp } from "lucide-react";

interface RecoveryCalculatorProps {
  totalAtraso: number;
}

export function RecoveryCalculator({ totalAtraso }: RecoveryCalculatorProps) {
  const [recoveryPct, setRecoveryPct] = useState(15);
  
  const estimatedRecovery = totalAtraso * (recoveryPct / 100);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm print:hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
          <Calculator className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-indigo-900">Simulador de Recuperação</h3>
      </div>
      
      <p className="text-xs text-indigo-700 mb-4">
        Arraste para simular o impacto de campanhas de cobrança no saldo final.
      </p>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-[11px] font-bold text-indigo-900 mb-2">
            <span>Meta de Recuperação</span>
            <span className="rounded bg-indigo-200 px-1.5 py-0.5">{recoveryPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={recoveryPct}
            onChange={(e) => setRecoveryPct(parseInt(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-indigo-200 accent-indigo-600"
          />
          <div className="flex justify-between text-[9px] text-indigo-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="rounded-xl bg-white p-3 border border-indigo-100">
            <p className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold">Total em Atraso</p>
            <p className="text-sm font-bold text-slate-900 mt-1">{kwanza.format(totalAtraso)}</p>
          </div>
          <div className="rounded-xl bg-indigo-600 p-3 shadow-md shadow-indigo-200">
            <p className="text-[9px] uppercase tracking-wider text-indigo-100 font-bold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Recuperação Est.
            </p>
            <p className="text-sm font-bold text-white mt-1">{kwanza.format(estimatedRecovery)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
