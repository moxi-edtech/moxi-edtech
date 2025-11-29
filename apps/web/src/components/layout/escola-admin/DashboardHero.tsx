"use client";

import { UploadCloud, UserPlus, Sparkles, FileSpreadsheet, Check, ArrowRight } from "lucide-react";

interface DashboardHeroProps {
  onImportClick: () => void;
  onManualClick: () => void;
}

export default function DashboardHero({ onImportClick, onManualClick }: DashboardHeroProps) {
  
  // A tua lista de passos (Pode vir de props futuramente)
  const steps = [
    {
      id: 1,
      title: "Definição da Estrutura Académica",
      completed: true,
      current: false,
    },
    {
      id: 2,
      title: "Importação de Alunos",
      description: "Necessário para gerar pautas e financeiro.",
      completed: false,
      current: true, // Onde estamos agora
    },
    {
      id: 3,
      title: "Configurar Preçário (Propinas)",
      description: "Defina os valores das mensalidades.",
      completed: false,
      current: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. O HERO CARD (Lado Esquerdo - 2/3 da largura) */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-10 text-white shadow-xl flex flex-col justify-between">
        
        {/* Decoração de Fundo */}
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-8 hidden opacity-10 md:block rotate-12">
          <FileSpreadsheet className="h-40 w-40" />
        </div>

        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300 backdrop-blur-md shadow-sm">
            <Sparkles className="h-3 w-3" />
            <span>Setup Inicial Concluído</span>
          </div>
          
          <h1 className="mb-4 text-3xl font-bold md:text-4xl leading-tight">
            A sua escola está pronta a arrancar. 🚀
          </h1>
          
          <p className="mb-8 text-sm leading-relaxed text-slate-300 md:text-base max-w-lg">
            A estrutura de classes e turmas já foi criada com sucesso. O motor está ligado! 
            Traga agora os seus alunos para começar a gerir matrículas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onImportClick}
              className="group flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-teal-500/20 transition-all hover:-translate-y-1 hover:bg-teal-400"
            >
              <UploadCloud className="h-5 w-5 transition-transform group-hover:scale-110" />
              Importar Lista CSV
            </button>
            
            <button
              onClick={onManualClick}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 font-bold text-white transition-all hover:bg-white/10"
            >
              <UserPlus className="h-5 w-5" />
              Manual
            </button>
          </div>
        </div>
      </div>

      {/* 2. A LISTA DE PRÓXIMOS PASSOS (Lado Direito - 1/3 da largura) */}
      <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col">
        <h3 className="font-bold text-slate-800 mb-6 text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
          O seu Progresso
        </h3>
        
        <div className="space-y-0 relative">
          {/* Linha vertical conectora */}
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-slate-100 -z-10"></div>

          {steps.map((step) => (
            <div 
              key={step.id}
              className={`group flex gap-4 py-4 ${!step.completed && !step.current ? 'opacity-50' : ''}`}
            >
              {/* O Ícone/Bolinha */}
              <div className={`
                relative shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10
                ${step.completed 
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                  : step.current
                  ? 'bg-white border-2 border-slate-900 shadow-sm'
                  : 'bg-slate-100 border-2 border-white'
                }
              `}>
                {step.completed ? (
                  <Check className="w-3.5 h-3.5" />
                ) : step.current ? (
                  <div className="w-2 h-2 rounded-full bg-slate-900 animate-ping" />
                ) : null}
              </div>

              {/* O Texto */}
              <div className="flex-1 -mt-1">
                <p className={`text-sm font-bold transition-colors ${
                  step.completed ? 'text-slate-500' : step.current ? 'text-slate-900' : 'text-slate-400'
                }`}>
                  {step.title}
                </p>
                
                {step.description && step.current && (
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    {step.description}
                  </p>
                )}

                {/* Botão de Ação no passo atual */}
                {step.current && (
                  <button 
                    onClick={onImportClick}
                    className="mt-3 text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 group-hover:gap-2 transition-all"
                  >
                    Resolver agora <ArrowRight className="w-3 h-3"/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footerzinho Motivacional */}
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Completado</span>
            <span className="font-bold text-slate-700">33%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full w-1/3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          </div>
        </div>

      </div>
    </div>
  );
}