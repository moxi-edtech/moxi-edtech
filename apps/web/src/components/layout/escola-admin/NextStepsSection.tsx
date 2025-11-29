"use client";

import { Check, Circle } from "lucide-react";

export default function NextSteps() {
  const steps = [
    {
      id: 1,
      title: "Definição da Estrutura Académica",
      description: "",
      completed: true,
      current: false,
    },
    {
      id: 2,
      title: "Importação de Alunos",
      description: "Necessário para gerar pautas e financeiro.",
      completed: false,
      current: true,
    },
    {
      id: 3,
      title: "Configurar Preçário (Propinas)",
      description: "",
      completed: false,
      current: false,
    },
  ];

  return (
    <div>
      <h3 className="font-bold text-slate-700 mb-4 text-sm">Próximos Passos</h3>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {steps.map((step) => (
          <div 
            key={step.id}
            className={`p-4 flex items-center gap-4 ${
              step.current ? 'bg-slate-50/50' : ''
            } ${!step.completed && !step.current ? 'opacity-60' : ''}`}
          >
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center
              ${step.completed 
                ? 'bg-emerald-100 text-emerald-600' 
                : step.current
                ? 'border-2 border-brand-900'
                : 'border-2 border-slate-200'
              }
            `}>
              {step.completed ? (
                <Check className="w-3.5 h-3.5" />
              ) : step.current ? (
                <div className="w-2 h-2 rounded-full bg-brand-900"></div>
              ) : null}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                step.completed 
                  ? 'text-slate-400 line-through'
                  : step.current
                  ? 'text-slate-800'
                  : 'text-slate-600'
              }`}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              )}
            </div>
            {step.current && (
              <button className="text-xs font-bold text-teal-600 hover:text-teal-700">
                Começar →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}