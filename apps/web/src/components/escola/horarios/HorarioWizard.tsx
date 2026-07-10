"use client";

import React, { useState } from "react";
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  School, 
  Clock, 
  LayoutDashboard,
  Zap,
  ShieldCheck,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/Button";

import { StepSalas } from "./wizard/StepSalas";
import { StepSlots } from "./wizard/StepSlots";

type Step = {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
};

const STEPS: Step[] = [
  { id: 0, title: "Ambientes", description: "Salas e espaços de aprendizagem.", icon: School },
  { id: 1, title: "Horários", description: "Estrutura de tempos e turnos.", icon: Clock },
  { id: 2, title: "Quadro", description: "Montagem e ajustes operacionais da grade.", icon: LayoutDashboard },
];

interface HorarioWizardProps {
  escolaId: string;
  onFinish?: () => void;
  initialStep?: number;
}

export function HorarioWizard({ escolaId, onFinish, initialStep = 0 }: HorarioWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const canProceed = true;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onFinish?.();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Configurar base do horário</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Defina apenas a estrutura-base. Cargas, professores e sala da turma ficam no próprio quadro.</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-klasse-gold/10 border border-klasse-gold/20 flex items-center justify-center">
            <Zap className="h-6 w-6 text-klasse-gold" />
        </div>
      </div>

      {/* Stepper Visual */}
      <div className="mb-12 flex items-center justify-between px-4 overflow-x-auto pb-6 scrollbar-hide">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center last:flex-none min-w-[120px]">
            <div className="flex flex-col items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
                currentStep > index ? "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm" :
                currentStep === index ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold shadow-md ring-4 ring-klasse-gold/10" :
                "border-slate-100 text-slate-300"
              }`}>
                {currentStep > index ? <CheckCircle2 className="h-6 w-6" /> : <step.icon className="h-5 w-5" />}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest text-center ${currentStep === index ? "text-slate-900" : "text-slate-400"}`}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mx-4 h-[2px] flex-1 rounded-full ${currentStep > index ? "bg-emerald-500" : "bg-slate-50"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo do Passo */}
      <div className="mb-10 min-h-[400px] rounded-3xl border border-slate-100 bg-slate-50/40 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/40 blur-3xl pointer-events-none" />
        
        <div className="w-full relative z-10">
          {currentStep === 0 && (
            <StepSalas escolaId={escolaId} onComplete={() => handleNext()} />
          )}
          {currentStep === 1 && (
            <StepSlots escolaId={escolaId} onComplete={() => handleNext()} />
          )}
          {currentStep === 2 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
                <LayoutDashboard className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="mb-2 text-xl font-black text-slate-900">Base pronta</h3>
              <p className="mb-8 max-w-md mx-auto text-sm text-slate-500">
                Ambientes e slots estão configurados. Continue no quadro para distribuir aulas, ajustar cargas, atribuir professores, definir sala e publicar.
              </p>
              <Button tone="gold" size="lg" onClick={onFinish} className="font-black gap-2">
                Ir para o Quadro <Wand2 className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between border-t border-slate-100 pt-8">
        <Button 
          tone="gray" 
          variant="ghost" 
          className="h-12 px-8 font-bold rounded-2xl"
          disabled={currentStep === 0 || loading}
          onClick={handleBack}
        >
          <ChevronLeft className="mr-2 h-5 w-5" /> Voltar
        </Button>
        
        {currentStep < STEPS.length - 1 && (
          <Button 
            tone="gold" 
            className="h-12 px-10 gap-2 font-black rounded-2xl shadow-lg shadow-klasse-gold/20"
            loading={loading}
            disabled={!canProceed}
            onClick={handleNext}
          >
            Próximo passo <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Footer Guard */}
      <div className="mt-8 flex items-center justify-center gap-2.5 py-3 px-6 rounded-2xl bg-slate-50/50 border border-slate-100 w-fit mx-auto">
        <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ambiente de Operação Segura • Klasse Timetable v2</span>
      </div>
    </div>
  );
}
