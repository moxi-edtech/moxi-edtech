"use client";

import React, { useState, useMemo } from "react";
import { Calculator, X, Sparkles, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Disciplina = {
  id: string;
  nome: string;
  nota_t1?: number | null;
  nota_t2?: number | null;
  nota_t3?: number | null;
  nota_final?: number | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  disciplinas: Disciplina[];
};

export function SimuladorNotasModal({ isOpen, onClose, disciplinas }: Props) {
  const [selectedDiscId, setSelectedDiscId] = useState<string>(disciplinas[0]?.id ?? "custom");
  
  const selectedDisc = useMemo(() => {
    return disciplinas.find((d) => d.id === selectedDiscId) ?? null;
  }, [disciplinas, selectedDiscId]);

  // Projected trimester grades (0 to 20)
  const [t1Input, setT1Input] = useState<number>(selectedDisc?.nota_t1 ?? 12);
  const [t2Input, setT2Input] = useState<number>(selectedDisc?.nota_t2 ?? 11);
  const [t3Input, setT3Input] = useState<number>(selectedDisc?.nota_t3 ?? 10);

  // Sync inputs when selected discipline changes
  React.useEffect(() => {
    if (selectedDisc) {
      setT1Input(selectedDisc.nota_t1 ?? 12);
      setT2Input(selectedDisc.nota_t2 ?? 11);
      setT3Input(selectedDisc.nota_t3 ?? 10);
    }
  }, [selectedDisc]);

  const mediaFinal = useMemo(() => {
    const val = (t1Input + t2Input + t3Input) / 3;
    return Math.round(val * 10) / 10;
  }, [t1Input, t2Input, t3Input]);

  // Grade needed in T3 to pass (MF >= 10)
  const t3NecessarioPassar = useMemo(() => {
    const minNeeded = 30 - (t1Input + t2Input);
    if (minNeeded <= 0) return 0;
    if (minNeeded > 20) return 20; // Impossible without extra credit
    return Math.round(minNeeded * 10) / 10;
  }, [t1Input, t2Input]);

  // Grade needed in T3 for merit/dispense (MF >= 14)
  const t3NecessarioMerito = useMemo(() => {
    const minNeeded = 42 - (t1Input + t2Input);
    if (minNeeded <= 0) return 0;
    if (minNeeded > 20) return 20;
    return Math.round(minNeeded * 10) / 10;
  }, [t1Input, t2Input]);

  const statusObj = useMemo(() => {
    if (mediaFinal >= 14) {
      return {
        label: "Dispensa / Mérito",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        icon: Sparkles,
        message: "Excelente desempenho! Garantes dispensa dos exames finais.",
      };
    }
    if (mediaFinal >= 10) {
      return {
        label: "Aprovado",
        color: "text-klasse-green-700 bg-klasse-green-50 border-klasse-green-200",
        icon: CheckCircle2,
        message: "Estás em zona de aprovação direta.",
      };
    }
    if (mediaFinal >= 8) {
      return {
        label: "Em Risco (Recurso)",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        icon: AlertCircle,
        message: "Atenção: precisas de reforçar os estudos para evitar o recurso.",
      };
    }
    return {
      label: "Reprovado Direto",
      color: "text-rose-700 bg-rose-50 border-rose-200",
      icon: AlertCircle,
      message: "Risco elevado. Fala com o teu professor ou coordenação pedagógica.",
    };
  }, [mediaFinal]);

  if (!isOpen) return null;

  const StatusIcon = statusObj.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="relative bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Fechar simulador"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-klasse-gold shadow-inner">
              <Calculator size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">Ferramenta Acadêmica</p>
              <h2 className="text-xl font-black text-white tracking-tight">Simulador de Aprovação</h2>
            </div>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Seletor de Disciplina */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Seleciona a Disciplina
            </label>
            <select
              value={selectedDiscId}
              onChange={(e) => setSelectedDiscId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 focus:border-klasse-green focus:bg-white focus:outline-none focus:ring-4 focus:ring-klasse-green/10"
            >
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} {d.nota_final != null ? `(Nota Atual: ${d.nota_final.toFixed(1)})` : ""}
                </option>
              ))}
              <option value="custom">Simulação Personalizada</option>
            </select>
          </div>

          {/* Sliders de Trimestres */}
          <div className="space-y-4 rounded-3xl bg-slate-50 p-4 border border-slate-100">
            {/* 1º Trimestre */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">1º Trimestre</span>
                <span className="text-slate-900 font-black text-sm">{t1Input.toFixed(1)} val</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={t1Input}
                onChange={(e) => setT1Input(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 appearance-none cursor-pointer accent-klasse-green"
              />
            </div>

            {/* 2º Trimestre */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">2º Trimestre</span>
                <span className="text-slate-900 font-black text-sm">{t2Input.toFixed(1)} val</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={t2Input}
                onChange={(e) => setT2Input(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 appearance-none cursor-pointer accent-klasse-green"
              />
            </div>

            {/* 3º Trimestre (Projetado) */}
            <div className="space-y-1 pt-1 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-700 flex items-center gap-1">
                  <Sparkles size={12} /> 3º Trimestre (Projetado)
                </span>
                <span className="text-emerald-700 font-black text-sm">{t3Input.toFixed(1)} val</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={t3Input}
                onChange={(e) => setT3Input(parseFloat(e.target.value))}
                className="w-full h-2.5 rounded-lg bg-emerald-200 appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          </div>

          {/* Resultado da Simulação */}
          <div className={`rounded-3xl border p-5 transition-all ${statusObj.color}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <StatusIcon size={20} />
                <span className="text-xs font-black uppercase tracking-wider">{statusObj.label}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Média Final</span>
                <span className="text-2xl font-black text-slate-900">{mediaFinal.toFixed(1)}</span>
              </div>
            </div>
            <p className="text-xs font-medium leading-relaxed">{statusObj.message}</p>
          </div>

          {/* Cartões de Meta de Apoio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Meta para Aprovar (≥10)</p>
              <p className="mt-1 text-base font-black text-slate-900">
                {t3NecessarioPassar <= 0 ? "Já Aprovado!" : `${t3NecessarioPassar.toFixed(1)} val no T3`}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-100">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/70">Meta para Dispensa (≥14)</p>
              <p className="mt-1 text-base font-black text-emerald-800">
                {t3NecessarioMerito <= 0 ? "Alcançada!" : `${t3NecessarioMerito.toFixed(1)} val no T3`}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <HelpCircle size={12} /> Cálculo baseado no sistema de avaliação nacional (Escala 0-20).
          </p>
          <Button tone="green" size="sm" onClick={onClose} className="rounded-xl font-bold px-5">
            Concluído
          </Button>
        </div>

      </div>
    </div>
  );
}
